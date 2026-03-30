const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('Hello from Safari AI Dev Studio Workspace!');
});

app.listen(port, () => {
  console.log(`Workspace app listening on port ${port}`);
});
