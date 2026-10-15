import { useNavigate } from 'react-router-dom';

const FocusAreaModal = ({ area, onClose, language }) => {
  const navigate = useNavigate();
  
  if (!area) return null;

  // Define module-specific details for IEPS modules
  const moduleDetails = {
    1: {
      featuresEn: [
        'Structured evaluation forms for course feedback',
        'Real-time student submission tracking',
        'Aggregated analytics by course and instructor',
        'Automatic reminders for pending evaluations',
        'Confidential feedback collection',
        'Export and reporting capabilities',
      ],
      featuresAm: [
        'ኮርስ ግምገማ አስተያየት የተዋቀረ ግምገማ ፎርም',
        'በእውነተኛ ጊዜ ተማሪ አቅርቦት ክትትል',
        'በኮርስ እና አስተምህር አጠቃላይ ትንተና',
        'ስዋ ግምገማዎች ለራስ-አስታወሳለሪ ስርዓት',
        'ሚስጢራዊ አስተያየት መሰብሰብ',
        'ወደ ውጪ ላኪ እና ሪፖርታ ዜናዎች',
      ],
      benefitsEn: 'Enables continuous feedback collection from students throughout the academic year, helping instructors improve teaching methods and course design based on real student input.',
      benefitsAm: 'በአካዳሚክ አመት ውስጥ ተማሪዎችን ምስ ተረጋጋሪ አስተያየት መሰብሰብ ይደግፋል፣ አስተምህራንን ተማሪዎችን የገሊጸ ግቤት ላይ ተመስርተው ትምህርታ ዘዴ እና ኮርስ ንድፍ ለማሳደግ ይረዳል።',
    },
    2: {
      featuresEn: [
        'Comprehensive evaluation cycle management',
        'Departmental performance dashboards',
        'Peer evaluation coordination and tracking',
        'Quality assurance cycle oversight',
        'Instructor development plan monitoring',
        'Department-level reporting and analytics',
      ],
      featuresAm: [
        'ሰፊ ግምገማ ዑደት ሥርዓተ አስተዳደር',
        'የክፍል አፈጻጸም ሰሌዳ',
        'አጓዳይ ግምገማ ትብብር እና ክትትል',
        'ጥራት ዳሰሳ ዑደት ቁጥጥር',
        'አስተምህር ልማት ፕላን ክትትል',
        'ክፍል ደረጃ ሪፖርታ እና ትንተና',
      ],
      benefitsEn: 'Provides department heads with comprehensive oversight tools to manage evaluation cycles, monitor instructor performance, and ensure quality assurance across all departmental programs.',
      benefitsAm: 'የክፍል ኮላዎችን ግምገማ ዑደቶችን ለመቆጣጠር፣ አስተምህር አፈጻጸም ክትትል ያድርግ፣ እና በሁሉም የክፍሉ ፕሮግራሞች ላይ ጥራት ዳሰሳ ብክል ሰፋ ቁጥጥር መሳሪያዎችን ይሰጣል።',
    },
    3: {
      featuresEn: [
        'Teaching philosophy and methodology documentation',
        'Professional development goal setting',
        'Research and publication tracking',
        'Course materials and syllabus repository',
        'Student feedback summary and trends',
        'Career advancement portfolio building',
      ],
      featuresAm: [
        'ትምህርታ ፍልስፍና እና ዘዴ ሰነድ',
        'ባሙያ ልማት ግብ ወቅ መግለጫ',
        'ምርምር እና ህትመት ክትትል',
        'ኮርስ ቁሳቁሶች እና ምሳሌ ማከማቻ',
        'ተማሪ አስተያየት ኑሮ እና አዝማሚያዎች',
        'ካሪየር ማስተጋገር ፖርትፎሊዮ ግንባታ',
      ],
      benefitsEn: 'Allows instructors to build a comprehensive professional portfolio, track their career development, and document evidence of teaching effectiveness and scholarly contributions for promotion and recognition.',
      benefitsAm: 'አስተምህራንን ሰፊ ባሙያ ፖርትፎሊዮ ግንባታ፣ ካሪየር ልማት ክትትል፣ እና ትምህርታ ውጤታማነት እና ምሐብ አስተዋጽኦ ማስረጃ ፓሞሌ እና ሪከግናይሽን ለመሰነድ ለመጠቀም ይደግፋል።',
    },
    4: {
      featuresEn: [
        'Institutional dashboard and KPI tracking',
        'Evaluation trend analysis and comparison',
        'Departmental performance rankings',
        'Academic quality metrics and insights',
        'Strategic planning data and forecasts',
        'Executive summary reports',
      ],
      featuresAm: [
        'ተቋማዊ ሰሌዳ እና KPI ክትትል',
        'ግምገማ አዝማሚያ ትንተና እና ንፅፅር',
        'የክፍል አፈጻጸም ደረጃ መለያ',
        'የአካዳሚክ ጥራት መለኪያ እና ግንዛቤ',
        'ስልታዊ ደረጃ ውሂብ እና ቅዳሚ ቅኖ',
        'ሊገር የ ኅሊና ሪፖርቶች',
      ],
      benefitsEn: 'Delivers data-driven insights to institutional leadership for strategic decision-making, program improvement, and long-term academic planning based on comprehensive evaluation metrics.',
      benefitsAm: 'ተቋማዊ መሪነት ሥልታዊ ውሳኔ፣ ፕሮግራም ማሻሻያ እና ሰፊ ግምገማ መለኪያ ላይ ተመስርተው ረጅም ጊዜ የአካዳሚክ ደረጃ የተሪየታ ግንዛቤ ይሰጣል።',
    },
  };

  const details = moduleDetails[area.id] || {};
  const features = language === 'en' ? details.featuresEn : details.featuresAm;
  const benefits = language === 'en' ? details.benefitsEn : details.benefitsAm;

  const handleNavigate = () => {
    if (area.moduleLink) {
      navigate(area.moduleLink);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-blue-700 to-blue-900 text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{language === 'en' ? area.nameEn : area.nameAm}</h2>
          <button
            onClick={onClose}
            className="text-2xl font-bold hover:opacity-80 transition-opacity"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Main Description */}
          <div>
            <p className="text-gray-700 text-lg leading-relaxed">
              {language === 'en' ? area.descriptionEn : area.descriptionAm}
            </p>
          </div>

          {/* Benefits Section */}
          <div>
            <h3 className="text-lg font-bold text-blue-900 mb-3">
              {language === 'en' ? 'Key Benefits:' : 'ዋና ጥቅሞች:'}
            </h3>
            <p className="text-gray-700">
              {benefits}
            </p>
          </div>

          {/* Features Section */}
          {features && features.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-blue-900 mb-3">
                {language === 'en' ? 'Module Features:' : 'ሞጁል ባህሪዎች:'}
              </h3>
              <ul className="space-y-2">
                {features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold mr-3 flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleNavigate}
              className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              {language === 'en' ? 'Access Module' : 'ሞጁል ዳውንሎድ'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
            >
              {language === 'en' ? 'Close' : 'ዝጋ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusAreaModal;
