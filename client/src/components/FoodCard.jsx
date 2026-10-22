import { Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const imageFallback = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80';

export default function FoodCard({ item, notify }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const image = item.imageUrl?.startsWith('/uploads/')
    ? `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000'}${item.imageUrl}`
    : item.imageUrl || imageFallback;

  async function add() {
    if (!user || user.role !== 'student') {
      navigate('/login', { state: { from: { pathname: `/foods/${item._id}` } } });
      return;
    }
    try {
      await addItem(item._id, 1);
      notify(`${item.name} added to your cart.`);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  return (
    <article className="food-card">
      <img className="food-image" src={image} alt={item.name} loading="lazy" />
      <div className="food-body">
        <div className="food-title-row">
          <Link className="food-name-link" to={`/foods/${item._id}`}><h3>{item.name}</h3></Link>
          <span className="price">{Number(item.price).toFixed(2)} ETB</span>
        </div>
        <p>{item.description || 'Freshly prepared on campus.'}</p>
        <Link className="detail-link" to={`/foods/${item._id}`}>View details</Link>
        <div className="food-meta">
          <span>{item.category?.name || 'Cafeteria favorite'}</span>
          <span>{item.preparationTime} min</span>
        </div>
        <button className="button button-small" type="button" disabled={!item.isAvailable || (user && user.role !== 'student')} onClick={add}>
          <Plus size={16} /> {!item.isAvailable ? 'Unavailable' : user && user.role !== 'student' ? 'Student ordering only' : user ? 'Add to cart' : 'Sign in to add'}
        </button>
      </div>
    </article>
  );
}
