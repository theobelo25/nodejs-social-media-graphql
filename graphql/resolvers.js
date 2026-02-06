const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Post = require("../models/post");
const clearImage = require("../util/clearImage");
const handleError = require("../util/handleError");

module.exports = {
  createUser: async function ({ userInput }, req) {
    const { email, password, name } = userInput;
    const errors = [];

    if (!validator.isEmail(email))
      errors.push({ message: "Email is invalid." });
    if (
      validator.isEmpty(password) ||
      !validator.isLength(password, { min: 5 })
    )
      errors.push({ message: "Password must be at least 5 characters." });

    if (errors.length > 0)
      throw handleError(null, 422, "Invalid input.", errors);

    try {
      const existingUser = await User.findOne({ email });

      if (existingUser) throw handleError(null, 409, "User already exists!");

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = new User({
        email,
        name,
        password: hashedPassword,
      });

      const createdUser = await user.save();

      return { ...createdUser._doc, _id: createdUser._id.toString() };
    } catch (error) {
      console.log(error);
    }
  },
  login: async function ({ email, password }) {
    const user = await User.findOne({ email });
    if (!user) throw handleError(null, 404, "User not found!");

    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) throw handleError(null, 401, "Password is incorrect.");

    const userId = user._id.toString();

    const token = jwt.sign(
      {
        userId: userId,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1hr" },
    );

    return { token, userId };
  },
  createPost: async function ({ postInput }, req) {
    if (!req.isAuth) throw handleError(null, 401, "Not authenticated");

    const { title, content, imageUrl } = postInput;

    const errors = [];
    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 }))
      errors.push({ message: "Title must be 5 characters or more." });
    if (validator.isEmpty(content) || !validator.isLength(content, { min: 5 }))
      errors.push({ message: "Content must be at least 5 characters long." });
    if (errors.length > 0)
      throw handleError(null, 422, "Invalid input.", errors);

    try {
      const user = await User.findById(req.userId);
      if (!user) throw handleError(null, 404, "User not found!");

      const post = new Post({
        title,
        content,
        imageUrl,
        creator: user,
      });
      user.posts.push(post);
      await user.save();

      const createdPost = await post.save();

      return {
        ...createdPost._doc,
        _id: createdPost._id.toString(),
        createdAt: createdPost.createdAt.toISOString(),
        updatedAt: createdPost.updatedAt.toISOString(),
      };
    } catch (error) {
      console.log(error);
    }
  },
  posts: async function ({ page }, req) {
    if (!req.isAuth) throw handleError(null, 401, "Not authenticated");

    if (!page) page = 1;
    const perPage = 2;

    try {
      const totalPosts = await Post.find().countDocuments();
      const posts = await Post.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .populate("creator");

      return {
        posts: posts.map((p) => {
          return {
            ...p._doc,
            _id: p._id.toString(),
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          };
        }),
        totalPosts,
      };
    } catch (error) {
      console.error(error);
    }
  },
  post: async function ({ id }, req) {
    if (!req.isAuth) throw handleError(null, 401, "Not authenticated");

    const post = await Post.findById(id).populate("creator");
    if (!post) throw handleError(null, 404, "Post not found.");

    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },
  updatePost: async function ({ id, postInput }, req) {
    if (!req.isAuth) throw handleError(null, 401, "Not authenticated");

    const { title, content, imageUrl } = postInput;

    try {
      const post = await Post.findById(id).populate("creator");
      if (!post) throw handleError(null, 404, "Post not found.");

      if (post.creator._id.toString() !== req.userId)
        throw handleError(null, 403, "Not authorized!");

      const errors = [];
      if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 }))
        errors.push({ message: "Title must be 5 characters or more." });
      if (
        validator.isEmpty(content) ||
        !validator.isLength(content, { min: 5 })
      )
        errors.push({ message: "Content must be at least 5 characters long." });
      if (errors.length > 0)
        throw handleError(null, 422, "Invalid input.", errors);

      post.title = title;
      post.content = content;
      if (imageUrl !== "undefined") post.imageUrl = imageUrl;

      const updatedPost = await post.save();

      return {
        ...updatedPost._doc,
        _id: updatedPost._id.toString(),
        createdAt: updatedPost.createdAt.toISOString(),
        updatedAt: updatedPost.updatedAt.toISOString(),
      };
    } catch (error) {
      console.error(error);
    }
  },
  deletePost: async function ({ id }, req) {
    if (!req.isAuth) throw handleError(null, 401, "Not authenticated");

    try {
      const post = await Post.findById(id);
      if (!post) throw handleError(null, 404, "Post not found.");

      if (post.creator._id.toString() !== req.userId)
        throw handleError(null, 403, "Not authorized!");

      clearImage(post.imageUrl);
      await Post.findByIdAndDelete(id);
      const user = await User.findById(req.userId);
      if (!user) throw handleError(null, 404, "User not found!");

      user.posts.pull(id);
      await user.save();
      return true;
    } catch (error) {
      console.error(error);
    }
  },
  user: async function (args, req) {
    if (!req.isAuth) throw handleError(null, 401, "Not authenticated");

    const user = await User.findById(req.userId);
    if (!user) throw handleError(null, 404, "User not found!");

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },
  updateStatus: async function ({ status }, req) {
    if (!req.isAuth) throw handleError(null, 401, "Not authenticated");

    const user = await User.findById(req.userId);
    if (!user) throw handleError(null, 404, "User not found!");

    user.status = status;

    await user.save();

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },
};
