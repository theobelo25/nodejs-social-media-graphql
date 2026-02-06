const handleError = (
  err,
  status = 500,
  message = "An Unknown Error Has Occurred!",
  data,
) => {
  if (!err) {
    const error = new Error(message);
    error.statusCode = status;
    if (data) error.data = data;
    console.error(error);
    return error;
  }
  if (err && !err.statusCode) {
    console.error(err.stack);
    err.statusCode = status;
    if (data) err.data = data;
    return err;
  }
  if (data) err.data = data;
  console.error(err.stack);
  return err;
};

module.exports = handleError;
