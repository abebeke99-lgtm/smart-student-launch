const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Menu item name is required'],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    imageUrl: {
      type: String,
      trim: true,
      validate: {
        validator(value) {
          if (!value) return true;
          if (/^\/uploads\/[a-f0-9-]+\.(jpg|png|gif|webp)$/i.test(value)) return true;
          try {
            const url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch {
            return false;
          }
        },
        message: 'Image URL must be a valid HTTP or HTTPS URL',
      },
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    preparationTime: {
      type: Number,
      required: [true, 'Preparation time is required'],
      min: [0, 'Preparation time cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Preparation time must be a whole number of minutes',
      },
    },
  },
  { timestamps: true },
);

menuItemSchema.index({ isAvailable: 1, category: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
