require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const connectDatabase = require('../config/database');

const seedAccounts = [
  {
    role: 'admin',
    name: process.env.SEED_ADMIN_NAME || 'Default Admin',
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
  },
  {
    role: 'foodmaker',
    name: process.env.SEED_FOODMAKER_NAME || 'Default Foodmaker',
    email: process.env.SEED_FOODMAKER_EMAIL,
    password: process.env.SEED_FOODMAKER_PASSWORD,
  },
];

const demoMenu = [
  { name: 'Injera with shiro', category: 'Lunch', price: 95, preparationTime: 15, description: 'Demonstration price in ETB.' },
  { name: 'Firfir', category: 'Breakfast', price: 80, preparationTime: 12, description: 'Demonstration price in ETB.' },
  { name: 'Tibs', category: 'Lunch', price: 180, preparationTime: 25, description: 'Demonstration price in ETB.' },
  { name: 'Pasta', category: 'Lunch', price: 110, preparationTime: 18, description: 'Demonstration price in ETB.' },
  { name: 'Rice', category: 'Dinner', price: 90, preparationTime: 15, description: 'Demonstration price in ETB.' },
  { name: 'Bread', category: 'Breakfast', price: 25, preparationTime: 5, description: 'Demonstration price in ETB.' },
  { name: 'Tea', category: 'Drinks', price: 18, preparationTime: 5, description: 'Demonstration price in ETB.' },
  { name: 'Coffee', category: 'Drinks', price: 30, preparationTime: 7, description: 'Demonstration price in ETB.' },
  { name: 'Bottled water', category: 'Drinks', price: 25, preparationTime: 1, description: 'Demonstration price in ETB.' },
  { name: 'Sambusa', category: 'Snacks', price: 35, preparationTime: 8, description: 'Demonstration price in ETB.' },
];

async function seedDemoMenu() {
  const categoryNames = [...new Set(demoMenu.map((item) => item.category))];
  const categories = new Map();
  for (const name of categoryNames) {
    const category = await Category.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, description: 'Sample category for demonstration data.' } },
      { new: true, upsert: true, runValidators: true },
    );
    categories.set(name, category._id);
  }

  for (const item of demoMenu) {
    await MenuItem.updateOne(
      { name: item.name, category: categories.get(item.category) },
      {
        $setOnInsert: {
          ...item,
          category: categories.get(item.category),
          isAvailable: true,
          imageUrl: '',
        },
      },
      { upsert: true, runValidators: true },
    );
  }
}

async function seed() {
  for (const account of seedAccounts) {
    if (!account.email || !account.password) {
      throw new Error(`SEED_${account.role.toUpperCase()}_EMAIL and password must be configured`);
    }
    if (Buffer.byteLength(account.password, 'utf8') < 8 || Buffer.byteLength(account.password, 'utf8') > 72) {
      throw new Error(`Seed password for ${account.role} must be between 8 and 72 bytes`);
    }
  }

  await connectDatabase();
  try {
    for (const account of seedAccounts) {
      const email = account.email.trim().toLowerCase();
      const existing = await User.findOne({ email });
      if (existing) {
        if (existing.role !== account.role) {
          throw new Error(`Account ${email} already exists with role "${existing.role}", expected "${account.role}"`);
        }
        console.log(`Seed account already exists: ${email} (${account.role})`);
        continue;
      }

      await User.create({ ...account, email });
      console.log(`Created seed account: ${email} (${account.role})`);
    }
    await seedDemoMenu();
    console.log('Sample categories and menu items are ready (illustrative ETB prices).');
  } finally {
    await mongoose.disconnect();
  }
}

seed()
  .catch((error) => {
    console.error('Account seeding failed:', error.message);
    process.exitCode = 1;
  });
