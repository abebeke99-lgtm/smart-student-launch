import { useContext } from 'react';
import {
  Shield,
  Info,
  Target,
  University,
  TrendingUp,
  Lock,
  Users,
  BookOpen,
  BarChart3,
  Zap,
} from 'lucide-react';
import { LanguageContext } from '../context/LanguageContext';

const About = () => {
  const { language } = useContext(LanguageContext);

  const content = {
    hero: {
      titleEn: 'About IEPS',
      titleAm: 'ስለ IEPS',
      subtitleEn:
        'The Instructor Performance Evaluation System (IEPS) is a comprehensive web-based platform designed for Mekdela Amba University to streamline the process of gathering student feedback on teaching performance.',
      subtitleAm:
        'የመምህራን የአፈጻጸም ግምገማ ስርዓት (IEPS) መቅደላ አምባ ዩኒቨርሲቲ ለተማሪ ግምገማ ሂደት ለመቀየር የተዲዘነ ሰፊ ድር-ላይ መድረግ ነው።',
    },
    mission: {
      titleEn: 'Our Mission',
      titleAm: 'የኛ ተልእኮ',
      contentEn:
        'To foster a culture of continuous improvement in teaching by providing a transparent, efficient, and accessible platform for student evaluations.',
      contentAm:
        'በመምህራን ውስጥ ቀጣይ ም改ህክ ባህል ምደራ ለመጠበቅ በትምህርት አገልግሎቶች ውስጥ ግልጽ እና ቀላል ስርዓት ማስተዋወቅ።',
    },
    background: {
      titleEn: 'Background & Inception',
      titleAm: 'ታሪክ እና መነሻ',
      contentEn:
        'Mekdela Amba University recognized the critical need to transition from manual, paper-based evaluation processes to a modern, digital platform. The traditional approach was time-consuming, difficult to analyze, and often resulted in low participation rates. The Instructor Performance Evaluation System was developed to address these challenges, enabling the university to collect, analyze, and act on valuable teaching performance data in real time. This digital transformation supports the university\'s commitment to academic excellence and continuous improvement in educational quality.',
      contentAm:
        'መቅደላ አምባ ዩኒቨርሲቲ ከመጽሔት-ላይ ግምገማ ሂደት ወደ ዘመናዊ ዲጂታል መድረግ ሊለወጥ የሚገባውን አስፈላጊነት ተረዳች። ባህላዊ አሰራር ጊዜ-ፈጅ እና ብዙውን ጊዜ ዝቅተኛ ተሳትፎ ደረጃ ያመጣ ነበር። የመምህራን አፈጻጸም ግምገማ ስርዓት እነዚህን ተግዳሮቶች ለመፍታት ተዘጋጅቷል።',
    },
    coreValues: {
      titleEn: 'Core Values',
      titleAm: 'ዋና እሴቶች',
      values: [
        {
          titleEn: 'Transparency',
          titleAm: 'ግልጽነት',
          descriptionEn:
            'Open and clear communication of evaluation processes and results to all stakeholders.',
          descriptionAm:
            'ግምገማ ሂደቶች እና ውጤቶች ለሁሉም ተሳታፊዎች ግልጽ የሆነ ግንኙነት።',
          icon: 'shield',
        },
        {
          titleEn: 'Accountability',
          titleAm: 'ሃላፊነት',
          descriptionEn:
            'Ensuring all participants are responsible for their roles in the evaluation process.',
          descriptionAm:
            'ሁሉም ተሳታፊዎች ግምገማ ሂደት ውስጥ ለራሳቸው ሚናዎች ሃላፊ መሆን።',
          icon: 'target',
        },
        {
          titleEn: 'Continuous Improvement',
          titleAm: 'ቀጣይ ምስባክ',
          descriptionEn:
            'Using evaluation feedback to support ongoing development and enhancement of teaching quality.',
          descriptionAm:
            'ግምገማ ምስክ መምህር ጥራት ለሚቀጥለው ምስባክ ወይም ለውጥ አስወጀት።',
          icon: 'trending-up',
        },
        {
          titleEn: 'Confidentiality & Fairness',
          titleAm: 'ሚስተር እና ሰላም',
          descriptionEn:
            'Protecting student privacy and ensuring fair, unbiased evaluation of all instructors.',
          descriptionAm:
            'የተማሪ ግላዊነት ጥበቃ እና ለሁሉም መምህራን ሰላማዊ ሙከራ።',
          icon: 'lock',
        },
      ],
    },
    keyBenefits: {
      titleEn: 'Key Benefits for Stakeholders',
      titleAm: 'ለክፍያ-ተሳታፊዎች ዋና ጥቅሞች',
      stakeholders: [
        {
          roleEn: 'For Students',
          roleAm: 'ለተማሪዎች',
          benefitsEn: [
            'Convenient digital platform to provide structured feedback',
            'Assurance that their evaluations remain confidential and anonymous',
            'Direct impact on teaching quality improvements',
            'Access to results showing instructor responsiveness to feedback',
          ],
          benefitsAm: [
            'ስርዓታዊ ግምገማ ይጠየቃሉ ዲጂታል መድረግ',
            'ግምገማዎ ሚስተር እና ስም-ሌላ ይሆናል መረጋገጥ',
            'ትምህርት ጥራት ለውጦች ላይ ቀጥተኛ ተጽዕኖ',
            'መምህር ምስክ ውስጥ ምላሽ ሲውሎ ውጤት ተደራ',
          ],
          icon: 'users',
        },
        {
          roleEn: 'For Administrators & Department Heads',
          roleAm: 'ለአስተዳደር ሰራተኞች እና ክፍል ጋዜጠኞች',
          benefitsEn: [
            'Real-time analytics and comprehensive performance insights',
            'Automated report generation for informed decision-making',
            'Identification of faculty development opportunities',
            'Data-driven resource allocation and program improvement',
            'Streamlined evaluation workflow management',
          ],
          benefitsAm: [
            'ሊቨር-ወቅታዊ ስታቲስቲክስ እና ሙሉ አፈጻጸም ትንበያ',
            'ራስ-ሰር ሪፖርት ስር ለውሳኔ ስለ ተዋስ',
            'መምህር ልማት እድገቶች ለይተ ለይቶ',
            'ውሂብ-ላይ መ资ሙሉ ስምሪያ እና ፕሮግራም ምስባክ',
            'ቀለጤ ግምገማ ስራ ዝግጅት ማስተዳደር',
          ],
          icon: 'bar-chart',
        },
        {
          roleEn: 'For Instructors',
          roleAm: 'ለመምህራን',
          benefitsEn: [
            'Actionable feedback to support professional development',
            'Detailed evaluation results with constructive insights',
            'Fair and transparent assessment of teaching performance',
            'Opportunities to address student concerns and improve practice',
            'Recognition of excellence and areas of strength',
          ],
          benefitsAm: [
            'የሙያ ልማት ለመደገፍ ተግባራዊ ምስክ',
            'በዝርዝር ግምገማ ውጤቶች ጋር ቋሚ ትንበያ',
            'ሰላም እና ግልጽ የአፈጻጸም ምዘና',
            'ተማሪ ጥያቄዎች ለመፍታት እና ተግባር ምሻሕ',
            'ድምገታ እና ጥሩ ሙሉ ንግግር መከበር',
          ],
          icon: 'zap',
        },
      ],
    },
    objectives: {
      titleEn: 'Key Objectives',
      titleAm: 'ዋና ግቦች',
      itemsEn: [
        'Replace manual paper-based evaluation with a digital solution',
        'Increase student participation in the evaluation process',
        'Provide real-time analytics and reports for administrators',
        'Support faculty development through actionable feedback',
        'Enhance the overall quality of education at Mekdela Amba University',
      ],
      itemsAm: [
        'ወረቀት-ላይ ግምገማ ወደ ዲጂታል ተክ',
        'ተማሪ ሳተሳትፎ ውስጥ ግምገማ ሂደት መጨመር',
        'ሊቨር-ወቅታዊ ስታቲስቲክስ እና ሪፖርቶች ለአስተዳደር',
        'መምህር ልማት ታሞ ጠንካራ ምስክ',
        'ትምህርት ጥራት መቅደላ አምባ ዩኒቨርሲቲ ውስጥ ማሻሻል',
      ],
    },
  };

  const getIcon = (iconType, className = 'w-12 h-12 text-blue-600') => {
    const iconProps = className;
    switch (iconType) {
      case 'shield':
        return <Shield className={iconProps} />;
      case 'info':
        return <Info className={iconProps} />;
      case 'target':
        return <Target className={iconProps} />;
      case 'university':
        return <University className={iconProps} />;
      case 'trending-up':
        return <TrendingUp className={iconProps} />;
      case 'lock':
        return <Lock className={iconProps} />;
      case 'users':
        return <Users className={iconProps} />;
      case 'bar-chart':
        return <BarChart3 className={iconProps} />;
      case 'zap':
        return <Zap className={iconProps} />;
      default:
        return <BookOpen className={iconProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <section className="py-14 md:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                title: content.hero,
                text: content.hero,
                icon: 'info',
              },
              {
                title: content.mission,
                text: content.mission,
                icon: 'target',
              },
              {
                title: content.background,
                text: content.background,
                icon: 'university',
              },
            ].map(({ title, text, icon }) => (
              <article
                key={title.titleEn}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center gap-3 rounded-t-2xl bg-[#2B6CB0] px-5 py-4 text-white">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                    {getIcon(icon, 'h-5 w-5 text-white')}
                  </div>
                  <h1 className="text-lg font-bold tracking-tight">
                    {language === 'en' ? title.titleEn : title.titleAm}
                  </h1>
                </div>
                <div className="p-5">
                  <p className="text-xs leading-relaxed text-slate-600">
                    {language === 'en' ? text.contentEn || text.subtitleEn : text.contentAm || text.subtitleAm}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-blue-900 md:text-4xl">
              {language === 'en' ? content.coreValues.titleEn : content.coreValues.titleAm}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {content.coreValues.values.map((value, idx) => (
              <div
                key={idx}
                className="group rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-6 shadow-md shadow-blue-100/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-5 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 text-white shadow-lg shadow-blue-200/80">
                    {getIcon(value.icon)}
                  </div>
                </div>
                <h3 className="mb-3 text-center text-xl font-bold text-blue-900">
                  {language === 'en' ? value.titleEn : value.titleAm}
                </h3>
                <p className="text-center text-sm leading-relaxed text-slate-600">
                  {language === 'en' ? value.descriptionEn : value.descriptionAm}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-14 md:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-blue-900 md:text-4xl">
              {language === 'en' ? content.keyBenefits.titleEn : content.keyBenefits.titleAm}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {content.keyBenefits.stakeholders.map((stakeholder, idx) => (
              <div
                key={idx}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex items-center gap-4 bg-gradient-to-r from-[#102d61] to-[#1d5aab] p-6 text-white">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    {getIcon(stakeholder.icon)}
                  </div>
                  <h3 className="text-xl font-bold">
                    {language === 'en' ? stakeholder.roleEn : stakeholder.roleAm}
                  </h3>
                </div>

                <div className="p-6">
                  <ul className="space-y-4">
                    {(language === 'en' ? stakeholder.benefitsEn : stakeholder.benefitsAm).map((benefit, bidx) => (
                      <li key={bidx} className="flex items-start gap-3">
                        <span className="mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-blue-600" />
                        <span className="text-sm leading-relaxed text-slate-700">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="h-1.5 w-12 rounded-full bg-blue-600" />
            <h2 className="text-3xl font-bold text-blue-900 md:text-4xl">
              {language === 'en' ? content.objectives.titleEn : content.objectives.titleAm}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {(language === 'en' ? content.objectives.itemsEn : content.objectives.itemsAm).map((objective, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm shadow-blue-100/70"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
                  {idx + 1}
                </div>
                <p className="text-base leading-relaxed text-slate-700 md:text-lg">{objective}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;