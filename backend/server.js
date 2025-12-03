const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Sequelize, DataTypes, Op } = require('sequelize');

const app = express();
const port = 8000;

app.use(cors());

// ---------------------------
// SEQUELIZE INIT
// ---------------------------

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.db',
  logging: false, // mets true pour voir les requêtes SQL
});

// ---------------------------
// MODELS
// ---------------------------

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.TEXT, allowNull: false, unique: true },
  email: { type: DataTypes.TEXT, allowNull: false },
  password: { type: DataTypes.TEXT, allowNull: false },
  is_admin: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.TEXT, allowNull: false },
  description: { type: DataTypes.TEXT },
  price: { type: DataTypes.REAL, allowNull: false },
  image: { type: DataTypes.TEXT },
  category: { type: DataTypes.TEXT },
  rating_rate: { type: DataTypes.REAL },
  rating_count: { type: DataTypes.INTEGER },
}, {
  tableName: 'products',
  timestamps: false,
});

// ---------------------------
// FUNCTIONS: INSERT DATA
// ---------------------------

async function insertRandomUsers() {
  try {
    const urls = [1, 2, 3, 4, 5].map(() => axios.get('https://randomuser.me/api/'));
    const results = await Promise.all(urls);
    const users = results.map(r => r.data.results[0]);

    for (const u of users) {
      const username = u.login.username;
      const password = u.login.password;
      const email = u.email;

      await User.create({
        username,
        email,
        password,
        is_admin: 0,
      });
    }

    console.log('Inserted 5 random users into database.');
  } catch (err) {
    console.error('Error inserting users:', err.message);
    throw err;
  }
}

async function insertProductsFromAPI() {
  try {
    const response = await axios.get('https://fakestoreapi.com/products');
    const products = response.data;

    const data = products.map(p => ({
      title: p.title,
      description: p.description,
      price: p.price,
      image: p.image,
      category: p.category,
      rating_rate: p.rating.rate,
      rating_count: p.rating.count,
    }));

    await Product.bulkCreate(data);
    console.log(`Inserted ${products.length} products into database.`);
  } catch (err) {
    console.error('Error fetching products:', err.message);
    throw err;
  }
}

// ---------------------------
// ROUTES
// ---------------------------

app.get('/generate-users', async (req, res) => {
  try {
    await insertRandomUsers();
    res.json({ success: true, message: 'Generated 5 random users' });
  } catch (err) {
    res.status(500).json({ error: 'Error generating users' });
  }
});

app.get('/generate-products', async (req, res) => {
  try {
    await insertProductsFromAPI();
    res.send('products generated');
  } catch (err) {
    res.status(500).json({ error: 'Error generating products' });
  }
});

// SEARCH PRODUCTS (sécurisé, via ORM)
app.get('/products/search', async (req, res) => {
  try {
    const searchTerm = req.query.q || '';

    const products = await Product.findAll({
      where: {
        [Op.or]: [
          { title: { [Op.like]: `%${searchTerm}%` } },
          { description: { [Op.like]: `%${searchTerm}%` } },
          { category: { [Op.like]: `%${searchTerm}%` } },
        ],
      },
    });

    res.json(products);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET ALL PRODUCTS
app.get('/products', async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET ONE PRODUCT BY ID (sécurisé)
app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: err.message });
  }
});

// ROOT
app.get('/', (req, res) => {
  res.send('Hello Ipssi v2 with Sequelize!');
});

// ---------------------------
// SERVER START (APRES SYNC)
// ---------------------------

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to SQLite via Sequelize.');

    await sequelize.sync(); // crée les tables si elles n’existent pas
    console.log('Database synced.');

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
  } catch (err) {
    console.error('Unable to start server:', err);
  }
})();
