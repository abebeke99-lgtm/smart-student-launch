import { useState, useContext, useEffect } from 'react';
import { Briefcase, Users, Award, BarChart3 } from 'lucide-react';
import { LanguageContext } from '../context/LanguageContext';
import { publicApi } from '../services/api';
import FocusAreaModal from './FocusAreaModal';
import { useUiText } from '../hooks/useUiText';

const UniversityFocusArea = () => {
  const t = useUiText();
  const { language } = useContext(LanguageContext);
  const [selectedArea, setSelectedArea] = useState(null);
  const [focusAreas, setFocusAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadFocusAreas = async () => {
      try {
        setLoading(true);
        const response = await publicApi.getIEPSFocusAreas();
        const normalizedAreas = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];

        if (isMounted) {
          setFocusAreas(normalizedAreas);
          setError(null);
        }
      } catch (err) {
        console.error('Unable to load IEPS focus areas:', err);
        if (isMounted) {
          setError(t('Unable to load focus areas'));
          setFocusAreas([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadFocusAreas();
    return () => {
      isMounted = false;
    };
  }, []);

  const getIcon = (iconType) => {
    const iconProps = 'w-16 h-16 text-blue-600';
    switch (iconType) {
      case 'users':
        return <Users className={iconProps} />;
      case 'briefcase':
        return <Briefcase className={iconProps} />;
      case 'award':
        return <Award className={iconProps} />;
      case 'chart':
        return <BarChart3 className={iconProps} />;
      default:
        return <Briefcase className={iconProps} />;
    }
  };

  return (
    <>
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-blue-900 mb-4">
              {language === 'en' ? t('IEPS Platform Modules') : 'IEPS ፕላትፎርም ሞጁሎች'}
            </h2>
            <p className="text-gray-700 text-lg max-w-3xl mx-auto">
              {language === 'en'
                ? t('Explore the core evaluation and assessment modules that power the Instructor Performance Evaluation System, designed to support comprehensive academic excellence and continuous improvement.')
                : 'አስተምህር አፈጻጸም ግምገማ ስርዓትን ሰጪውን ዋና ግምገማ እና ግምገማ ሞጁሎችን ይዳሰሱ፣ ሰፊ የአካዳሚክ ሉ優excellence እና ቀጣይነት ያለው ማሳደግን ለመደገፍ ታስቦ የተዋቀረ።'}
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-300 border-t-blue-600 mb-4" />
                <p className="text-gray-600">
                  {language === 'en' ? t('Loading focus areas...') : 'ትኩረት ያላቸው ቦታዎች ይጫናሉ...'}
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center mb-8">
              <p className="text-red-700">
                {language === 'en' ? t('Unable to load focus areas. Please try again later.') : 'ትኩረት ያላቸው ቦታዎችን ማወቅ አልተቻለም። እንደገና ይሞክሩ።'}
              </p>
            </div>
          )}

          {/* Cards Grid */}
          {!loading && !error && focusAreas.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {focusAreas.map((area) => (
                <div
                  key={area.id}
                  onClick={() => setSelectedArea(area)}
                  className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 p-8 cursor-pointer group"
                >
                  <div className="flex justify-center mb-6">
                    <div className="p-4 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                      {getIcon(area.iconType)}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-center text-blue-900 mb-4">
                    {language === 'en' ? area.nameEn : area.nameAm}
                  </h3>
                  <p className="text-gray-600 text-center text-sm mb-6">
                    {language === 'en' ? area.descriptionEn : area.descriptionAm}
                  </p>
                  <div className="text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedArea(area);
                      }}
                      className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                    >
                      {language === 'en' ? t('Learn More') : 'ተጨማሪ ይወቁ'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && focusAreas.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">
                {language === 'en' ? t('No focus areas available.') : 'ገቢ ትኩረት ያላቸው ቦታዎች የሉም።'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Modal */}
      {selectedArea && (
        <FocusAreaModal
          area={selectedArea}
          onClose={() => setSelectedArea(null)}
          language={language}
        />
      )}
    </>
  );
};

export default UniversityFocusArea;
