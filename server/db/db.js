// const mongoose = require('mongoose');

// async function connectDB(uri) {
//   try {
//     await mongoose.connect(uri);
//     // eslint-disable-next-line no-console
//     console.log('Connected to MongoDB');
//   } catch (e) {
//     console.error('Could not connect');
//     process.exit();
//   }
// }

// function closeDB() {
//   mongoose.connection.close();
//   // eslint-disable-next-line no-console
//   console.log('Database connection has been closed');
// }

// function dropCollection(model){
//   model.collection.drop();
// }

// module.exports = { connectDB, closeDB, dropCollection};
