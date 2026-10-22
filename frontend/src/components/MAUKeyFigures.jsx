import { useEffect, useState, useContext, useRef } from 'react';
import { Users, CheckCircle, BookOpen, FileText, BarChart3, Zap, Award, Clock } from 'lucide-react';
import { LanguageContext } from '../context/LanguageContext';
import { publicApi } from '../services/api';
import { useUiText } from '../hooks/useUiText';

const AnimatedCounter = ({ target, duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasStarted) {
        setHasStarted(true);
      }
    });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentCount = Math.floor(progress * target);
      setCount(currentCount);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [hasStarted, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
};

const MAUKeyFigures = () => {
  const t = useUiText();
  const { language } = useContext(LanguageContext);
  const [systemStats, setSystemStats] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadSystemStats = async () => {
      try {
        const stats = await publicApi.getSystemStats();
        if (isMounted) setSystemStats(stats);
      } catch (error) {
        console.error('Unable to load system statistics:', error);
        if (isMounted) setSystemStats({});
      }
    };

    void loadSystemStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const figures = [
    {
      id: 1,
      value: systemStats?.activeStudentEvaluators,
      labelEn: 'Active Students / Evaluators',
      labelAm: 'ንቁ ተማሪዎች / ግምገማ ሰጪዎች',
      icon: Users,
      descriptionEn: 'Students actively engaged in instructor evaluations',
      descriptionAm: 'በአስተምህሮ ግምገማ ውስጥ ንቅዓት ያለባቸው ተማሪዎች',
    },
    {
      id: 2,
      value: systemStats?.evaluatedInstructors,
      labelEn: 'Evaluated Instructors',
      labelAm: 'የተገመገሙ አስተምህራን',
      icon: CheckCircle,
      descriptionEn: 'Academic instructors evaluated in the IEPS system',
      descriptionAm: 'በ IEPS ስርዓት ውስጥ የተገመገሙ አካዳሚክ አስተምህራን',
    },
    {
      id: 3,
      value: systemStats?.participatingDepartments,
      labelEn: 'Participating Departments',
      labelAm: 'ተሳታፊ ክፍሎች',
      icon: BookOpen,
      descriptionEn: 'Academic departments using the IEPS platform',
      descriptionAm: 'IEPS ፕላትፍርም ይጠቀማሉ አካዳሚክ ክፍሎች',
    },
    {
      id: 4,
      value: systemStats?.completedEvaluations,
      labelEn: 'Completed Evaluation Reports',
      labelAm: 'ተጠናቀቁ ግምገማ ሪፖርቶች',
      icon: FileText,
      descriptionEn: 'Submitted evaluation reports within IEPS',
      descriptionAm: 'በ IEPS ውስጥ የቀረቡ ግምገማ ሪፖርቶች',
    },
    {
      id: 5,
      value: systemStats?.qualityAssuranceReviews,
      labelEn: 'Quality Assurance Reviews',
      labelAm: 'ጥራት ዳሰሳ ግምገማዎች',
      icon: BarChart3,
      descriptionEn: 'Department-level quality assurance cycles',
      descriptionAm: 'በክፍል ደረጃ ጥራት ዳሰሳ ዑደቶች',
    },
    {
      id: 6,
      value: systemStats?.peerEvaluations,
      labelEn: 'Peer Evaluations',
      labelAm: 'አጓዳይ ግምገማዎች',
      icon: Zap,
      descriptionEn: 'Colleague-to-colleague performance reviews',
      descriptionAm: 'አጓዳይ-ለ-አጓዳይ አፈጻጸም ግምገማዎች',
    },
    {
      id: 7,
      value: systemStats?.improvementPlans,
      labelEn: 'Performance Plans',
      labelAm: 'አፈጻጸም ፕላናች',
      icon: Award,
      descriptionEn: 'Active professional development plans',
      descriptionAm: 'ንቅዓት ያለባቸው ባሙያ ልማት ፕላናች',
    },
    {
      id: 8,
      value: systemStats?.systemUptime,
      labelEn: 'System Uptime',
      labelAm: 'ስርዓት አሰራር ጊዜ',
      icon: Clock,
      labelSuffix: '%',
      descriptionEn: 'IEPS platform availability',
      descriptionAm: 'IEPS ፕላትፍርም ይገኛል',
    },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-blue-900 mb-4">
            {language === 'en' ? t('IEPS SYSTEM METRICS') : 'IEPS ስርዓት መለኪያዎች'}
          </h2>
          <p className="text-gray-700 text-lg">
            {language === 'en' 
              ? t('Real-time instructor evaluation platform statistics and system operational metrics')
              : 'በእውነተኛ ጊዜ አስተምህር ግምገማ ፕላትፎርም ስታቲስቲክስ እና ስርዓት አሰራር መለኪያዎች'}
          </p>
        </div>

        {/* Figures Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {figures.map((figure) => {
            const Icon = figure.icon;
            return (
              <div
                key={figure.id}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 shadow-md hover:shadow-lg transition-all duration-300 text-center hover:-translate-y-1 border border-blue-100"
              >
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-blue-200 rounded-full">
                    <Icon className="w-8 h-8 text-blue-700" />
                  </div>
                </div>

                <h3 className="text-3xl md:text-4xl font-bold text-blue-900 mb-1">
                  {figure.value === undefined ? (
                    <span className="inline-block h-10 w-12 animate-pulse rounded bg-blue-300" aria-label={t('Loading')} />
                  ) : (
                    <>
                      <AnimatedCounter target={figure.value} duration={2500} />
                      {figure.labelSuffix && <span>{figure.labelSuffix}</span>}
                    </>
                  )}
                </h3>

                <p className="text-blue-900 font-semibold text-sm md:text-base mb-2">
                  {language === 'en' ? t(figure.labelEn) : figure.labelAm}
                </p>

                <p className="text-gray-600 text-xs md:text-sm">
                  {language === 'en' ? t(figure.descriptionEn) : figure.descriptionAm}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MAUKeyFigures;
