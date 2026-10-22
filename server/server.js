require('dotenv').config();

const app = require('./app');
const connectDatabase = require('./src/config/database');

const port = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    await connectDatabase();
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
  }
}

startServer();
