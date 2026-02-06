const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const handleError = require("../util/handleError");

const User = require("../models/user");

exports.signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw handleError(
      null,
      422,
      "Validation failed, entered data is incorrect.",
      errors.array(),
    );
  }

  const { email, name, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      email,
      password: hashedPassword,
      name,
    });
    const savedUser = await user.save();

    res
      .status(201)
      .json({ message: "User successfully created!", user: savedUser });
  } catch (error) {
    next(handleError(error));
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) throw handleError(null, 401, "User could not be found");

    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) throw handleError(null, 401, "Invalid password");

    const token = jwt.sign(
      {
        email: user.email,
        userId: user._id.toString(),
      },
      "alexanderisagoodboy",
      { expiresIn: "1hr" },
    );

    res.status(200).json({ token, userId: user._id.toString() });
  } catch (error) {
    next(handleError(error));
  }
};

exports.getUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) throw handleError(null, 404, "User not found.");

    res.status(200).json({ status: user.status });
  } catch (error) {
    next(handleError(error));
  }
};

exports.updateUserStatus = async (req, res, next) => {
  const newStatus = req.body.status;

  try {
    const user = await User.findById(req.userId);
    if (!user) throw handleError(null, 404, "User not found.");

    user.status = newStatus;
    const updatedUser = await user.save();
    res.status(200).json({ status: updatedUser.status });
  } catch (error) {
    next(handleError(error));
  }
};
