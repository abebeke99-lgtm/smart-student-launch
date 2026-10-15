
const MapEmbed = ({ className = '', query = 'Mekdela Amba University Gimba Ethiopia' }) => {
  return (
    <div className={`w-full overflow-hidden rounded-xl border border-gray-200 shadow-lg ${className}`}>
      <iframe
        src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`}
        width="100%"
        height="100%"
        style={{ border: 0, minHeight: '360px' }}
        allowFullScreen=""
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Mekdela Amba University Location"
      ></iframe>
    </div>
  );
};

export default MapEmbed;
