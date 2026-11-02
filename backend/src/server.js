import 'dotenv/config';
import { connectDatabase } from './config/database.js';
import app from './app.js';

const port = Number(process.env.PORT || 5000);

if (process.env.NODE_ENV !== 'test') {
  connectDatabase()
    .then(() => app.listen(port, () => console.log(`API listening on port ${port}`)))
    .catch((error) => {
      console.error('Unable to start API:', error.message);
      process.exitCode = 1;
    });
}
