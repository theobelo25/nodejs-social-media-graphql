const { validationResult } = require("express-validator");

const handleError = require("../util/handleError");
const clearImage = require("../util/clearImage");
const io = require("../socket");

const Post = require("../models/post");
const User = require("../models/user");

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page;
  const perPage = 2;
  let totalItems;
  try {
    const count = await Post.find().countDocuments();
    totalItems = count;

    const posts = await Post.find()
      .populate("creator")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res
      .status(200)
      .json({ message: "Fetched posts successfully!", posts, totalItems });
  } catch (error) {
    next(handleError(error));
  }
};

exports.createPost = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw handleError(
      null,
      422,
      "Validation failed, entered data is incorrect.",
      errors.array(),
    );
  }
  if (!req.file) {
    throw handleError(null, 422, "Validation failed, no image provided.");
  }

  const { title, content } = req.body;
  const imageUrl = req.file.path.replace("\\", "/");
  const userId = req.userId;

  const post = new Post({
    title,
    content,
    imageUrl,
    creator: userId,
  });
  try {
    const newPost = await post.save();
    const user = await User.findById(userId);
    user.posts.push(newPost);
    await user.save();
    io.getIO().emit("posts", {
      action: "create",
      post: { ...post._doc, creator: { _id: req.userId, name: user.name } },
    });
    res.status(201).json({
      message: "Post created successfully!",
      post,
      creator: { _id: user._id, name: user.name },
    });
  } catch (error) {
    next(handleError(error, 500));
  }
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;

  try {
    const post = await Post.findById(postId);

    if (!post) {
      throw handleError(null, 404, "Could not find post.");
    }

    return res
      .status(200)
      .json({ message: "Post fetched successfully!", post });
  } catch (error) {
    next(handleError(error));
  }
};

exports.updatePost = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw handleError(
      null,
      422,
      "Validation failed, entered data is incorrect.",
      errors.array(),
    );
  }

  const postId = req.params.postId;
  const { title, content } = req.body;
  let imageUrl = req.body.image;
  if (req.file) imageUrl = req.file.path.replace("\\", "/");
  if (!imageUrl) {
    throw handleError(null, 422, "No image was found.");
  }

  try {
    const post = await Post.findById(postId).populate("creator");
    if (!post) throw handleError(null, 404, "Could not find post.");
    if (post.creator._id.toString() !== req.userId.toString())
      throw handleError(null, 403, "Not authorized!");

    if (imageUrl !== post.imageUrl) clearImage(post.imageUrl);

    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;

    const newPost = await post.save();
    io.getIO().emit("posts", {
      action: "update",
      post: newPost,
    });
    res
      .status(200)
      .json({ message: "Post updated successfully!", post: newPost });
  } catch (error) {
    next(handleError(error));
  }
};

exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;

  try {
    const post = await Post.findById(postId);
    if (!post) throw handleError(null, 404, "Could not find post.");
    if (post.creator.toString() !== req.userId.toString())
      throw handleError(null, 403, "Not authorized!");

    clearImage(post.imageUrl);

    await Post.findByIdAndDelete(postId);
    const user = await User.findById(req.userId);

    user.posts.pull(postId);
    await user.save();

    io.getIO().emit("posts", {
      action: "delete",
      post: postId,
    });
    res.status(200).json({ message: "Post deleted successfully!" });
  } catch (error) {
    next(handleError(error));
  }
};
