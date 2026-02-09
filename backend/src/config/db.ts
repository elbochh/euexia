import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/euexia';
    // Debug: show redacted URI so we can verify it's loading correctly
    console.log('Connecting to MongoDB:', uri.replace(/:([^@]+)@/, ':***@'));
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

