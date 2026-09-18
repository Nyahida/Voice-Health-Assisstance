/**
 * Clinical Specialty Recommendation Engine
 * Analyzes patient-reported symptoms, complete utterance context, red-flag indicators,
 * and maps to appropriate primary & secondary medical specialties.
 */

export interface SpecialtyRecommendation {
  specialty: string;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  isEmergency?: boolean;
}

export interface RecommendationResult {
  identifiedIssue: string;
  primarySpecialty: string;
  secondarySpecialties: SpecialtyRecommendation[];
  allRecommendations: SpecialtyRecommendation[];
  hasRedFlags: boolean;
  redFlagDetails: string[];
  suggestedTriageLevel: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
}

interface SpecialtyRule {
  specialty: string;
  primaryKeywords: string[];
  secondaryKeywords: string[];
  negativeKeywords?: string[];
  reasoningTemplate: string;
}

const SPECIALTY_RULES: SpecialtyRule[] = [
  {
    specialty: 'General Medicine',
    primaryKeywords: [
      'sleepy', 'sleepiness', 'drowsy', 'drowsiness', 'fatigue', 'tired', 'tiredness', 
      'exhaustion', 'exhausted', 'lethargic', 'lethargy', 'malaise', 'weakness', 
      'fever', 'chills', 'flu', 'cold', 'infection', 'unwell', 'checkup', 'general health',
      'weight loss', 'night sweats', 'appetite loss', 'routine visit'
    ],
    secondaryKeywords: ['headache', 'dizzy', 'nausea', 'cough', 'sleep schedule', 'energy'],
    reasoningTemplate: 'General Medicine / Internal Medicine is appropriate for comprehensive clinical evaluation of non-specific or systemic symptoms like fatigue, daytime drowsiness, or general wellness checks.'
  },
  {
    specialty: 'Orthopedics',
    primaryKeywords: [
      'knee', 'shoulder', 'joint', 'bone', 'ligament', 'tendon', 'hip', 'spine', 
      'back pain', 'lumbar', 'elbow', 'wrist', 'ankle', 'fracture', 'sprain', 
      'dislocation', 'rotator cuff', 'meniscus', 'acl', 'ortho', 'swelling in joint',
      'cartilage', 'walking pain'
    ],
    secondaryKeywords: ['stiffness', 'injury', 'fall', 'sports', 'clicking', 'lock', 'pop'],
    negativeKeywords: ['rash', 'chest', 'eye', 'ear', 'stomach'],
    reasoningTemplate: 'Orthopedics specializes in the musculoskeletal system, evaluating bones, joints, ligaments, tendons, and spine issues.'
  },
  {
    specialty: 'Cardiology',
    primaryKeywords: [
      'heart', 'chest pain', 'chest tightness', 'chest pressure', 'palpitation', 
      'palpitations', 'fluttering', 'racing heart', 'arrhythmia', 'hypertension', 
      'high blood pressure', 'angina', 'cardiac', 'cardio'
    ],
    secondaryKeywords: ['shortness of breath', 'lightheaded', 'dizzy', 'exertion', 'cholesterol', 'swelling feet'],
    reasoningTemplate: 'Cardiology evaluates disorders of the heart, circulation, high blood pressure, and arrhythmias.'
  },
  {
    specialty: 'Neurology',
    primaryKeywords: [
      'headache', 'migraine', 'dizziness', 'vertigo', 'numbness', 'tingling', 
      'pins and needles', 'neuropathy', 'nerve', 'nerve pain', 'seizure', 'seizures', 
      'epilepsy', 'stroke', 'tremor', 'shaking', 'memory loss', 'brain', 'confusion', 
      'sciatica', 'bell\'s palsy'
    ],
    secondaryKeywords: ['weakness', 'sleep apnea', 'narcolepsy', 'balance', 'vision loss', 'unsteady'],
    reasoningTemplate: 'Neurology specializes in disorders of the brain, spinal cord, nerves, and complex sleep or movement disorders.'
  },
  {
    specialty: 'Dermatology',
    primaryKeywords: [
      'skin', 'rash', 'acne', 'eczema', 'psoriasis', 'itching', 'itchy', 'hives', 
      'mole', 'lesion', 'blister', 'dermatitis', 'wart', 'scalp', 'hair loss', 
      'sunburn', 'discoloration', 'skin bump'
    ],
    secondaryKeywords: ['dry skin', 'flaking', 'redness', 'spots', 'allergic reaction'],
    reasoningTemplate: 'Dermatology addresses diseases and conditions of the skin, hair, and nails.'
  },
  {
    specialty: 'ENT',
    primaryKeywords: [
      'ear', 'ear pain', 'earache', 'hearing loss', 'tinnitus', 'ringing in ear', 
      'throat', 'sore throat', 'tonsils', 'tonsillitis', 'swallowing', 'hoarseness', 
      'voice', 'sinus', 'sinusitis', 'nasal', 'stuffy nose', 'nosebleed', 'ent', 
      'otolaryngology'
    ],
    secondaryKeywords: ['congestion', 'drainage', 'snoring', 'smell'],
    reasoningTemplate: 'ENT (Otolaryngology) specializes in disorders of the ear, nose, throat, sinuses, and larynx.'
  },
  {
    specialty: 'Gastroenterology',
    primaryKeywords: [
      'stomach', 'stomach pain', 'abdominal pain', 'belly pain', 'cramps', 'digestive', 
      'digestion', 'acid reflux', 'heartburn', 'gerd', 'nausea', 'vomiting', 'diarrhea', 
      'constipation', 'bloating', 'gas', 'bowel', 'colon', 'liver', 'gallbladder', 
      'gastric', 'ulcer', 'ibs'
    ],
    secondaryKeywords: ['indigestion', 'blood in stool', 'loss of appetite'],
    reasoningTemplate: 'Gastroenterology focuses on the digestive system, including the esophagus, stomach, intestines, liver, and gallbladder.'
  },
  {
    specialty: 'Pulmonology',
    primaryKeywords: [
      'breathing', 'shortness of breath', 'breathless', 'persistent cough', 'coughing', 
      'asthma', 'wheezing', 'bronchitis', 'lungs', 'lung', 'pulmonary', 'copd', 
      'respiratory', 'phlegm', 'inhaler'
    ],
    secondaryKeywords: ['chest congestion', 'oxygen', 'smoker', 'sleep apnea'],
    reasoningTemplate: 'Pulmonology specializes in diseases of the respiratory tract, lungs, and chronic airway disorders.'
  },
  {
    specialty: 'Gynecology',
    primaryKeywords: [
      'period', 'menstrual', 'menstruation', 'cramps', 'pelvic pain', 'pregnancy', 
      'pregnant', 'vaginal', 'ovary', 'ovarian', 'uterus', 'pcos', 'endometriosis', 
      'pap smear', 'contraception', 'gynecology', 'gynae', 'menopause'
    ],
    secondaryKeywords: ['heavy bleeding', 'discharge', 'spotting'],
    reasoningTemplate: 'Gynecology provides specialized medical care for female reproductive health, cycles, and pelvic conditions.'
  },
  {
    specialty: 'Pediatrics',
    primaryKeywords: [
      'child', 'baby', 'toddler', 'kid', 'infant', 'newborn', 'pediatric', 
      'pediatrician', 'son', 'daughter', 'vaccination', 'growth'
    ],
    secondaryKeywords: ['school', 'teething', 'crying', 'fever in baby'],
    reasoningTemplate: 'Pediatrics focuses on the physical, emotional, and social health of infants, children, and adolescents.'
  },
  {
    specialty: 'Ophthalmology',
    primaryKeywords: [
      'eye', 'eyes', 'vision', 'blurry vision', 'double vision', 'eye pain', 
      'red eye', 'cataract', 'glaucoma', 'cornea', 'retina', 'dry eyes', 
      'conjunctivitis', 'pink eye', 'ophthalmology'
    ],
    secondaryKeywords: ['squint', 'floaters', 'flashes', 'glasses'],
    reasoningTemplate: 'Ophthalmology specializes in the diagnosis, medical management, and surgical treatment of eye and vision disorders.'
  },
  {
    specialty: 'Urology',
    primaryKeywords: [
      'urine', 'urinary', 'urination', 'burning urination', 'frequent urination', 
      'bladder', 'prostate', 'kidney stone', 'kidney stones', 'incontinence', 
      'urology', 'dysuria', 'testicular', 'flank pain'
    ],
    secondaryKeywords: ['blood in urine', 'urinary tract', 'pelvic'],
    reasoningTemplate: 'Urology manages conditions affecting the urinary tract system and male reproductive organs.'
  },
  {
    specialty: 'Psychiatry',
    primaryKeywords: [
      'anxiety', 'anxious', 'panic', 'panic attack', 'depression', 'depressed', 
      'stress', 'mental health', 'insomnia', 'mood', 'bipolar', 'adhd', 'ptsd', 
      'obsessive', 'psychiatry', 'counseling'
    ],
    secondaryKeywords: ['worry', 'crying', 'hopeless', 'concentration'],
    reasoningTemplate: 'Psychiatry specializes in the assessment, diagnosis, and medical treatment of mental, emotional, and behavioral disorders.'
  },
  {
    specialty: 'Endocrinology',
    primaryKeywords: [
      'diabetes', 'blood sugar', 'glucose', 'insulin', 'thyroid', 'hypothyroid', 
      'hyperthyroid', 'goiter', 'hormone', 'hormonal', 'metabolism', 'endocrine', 
      'endocrinology', 'adrenal', 'pituitary'
    ],
    secondaryKeywords: ['weight gain', 'weight loss', 'cold intolerance', 'excessive thirst'],
    reasoningTemplate: 'Endocrinology manages hormonal imbalances, thyroid conditions, diabetes, and metabolic disorders.'
  },
  {
    specialty: 'Nephrology',
    primaryKeywords: [
      'kidney', 'kidneys', 'nephrology', 'dialysis', 'creatinine', 'proteinuria', 
      'chronic kidney', 'renal', 'kidney failure', 'swollen ankles', 'fluid retention'
    ],
    secondaryKeywords: ['glomerular', 'filtration', 'hypertension resistant'],
    reasoningTemplate: 'Nephrology specializes in the diagnosis and care of kidney diseases and renal dysfunction.'
  },
  {
    specialty: 'Rheumatology',
    primaryKeywords: [
      'arthritis', 'rheumatoid', 'rheumatoid arthritis', 'lupus', 'autoimmune', 
      'gout', 'joint inflammation', 'morning stiffness', 'spondylitis', 'rheumatology', 
      'fibromyalgia', 'connective tissue'
    ],
    secondaryKeywords: ['swollen knuckles', 'chronic pain', 'flare'],
    reasoningTemplate: 'Rheumatology focuses on systemic autoimmune conditions and inflammatory disorders of joints and soft tissues.'
  },
  {
    specialty: 'Physiotherapy',
    primaryKeywords: [
      'physiotherapy', 'physical therapy', 'rehabilitation', 'rehab', 'posture', 
      'muscle strain', 'stretching', 'mobility', 'stiff neck', 'exercise therapy', 
      'sciatica exercises', 'post surgery rehab'
    ],
    secondaryKeywords: ['range of motion', 'strengthening', 'ergonomics'],
    reasoningTemplate: 'Physiotherapy specializes in restoring movement, function, and alleviating pain through targeted rehabilitation and exercise.'
  }
];

export class SpecialtyRecommendationService {
  /**
   * Recommend specialties based on complete patient statement context.
   */
  public recommend(utterance: string): RecommendationResult {
    const text = utterance.toLowerCase().trim();
    const redFlagDetails: string[] = [];
    let isEmergency = false;

    // 1. Check for Emergency Red Flags
    if (
      (text.includes('chest pain') || text.includes('chest pressure')) && 
      (text.includes('sweating') || text.includes('jaw') || text.includes('arm') || text.includes('severe') || text.includes('crushing'))
    ) {
      isEmergency = true;
      redFlagDetails.push('Potential acute coronary syndrome / crushing chest pain with radiation');
    }
    if (text.includes('sudden numbness') || text.includes('slurred speech') || text.includes('facial droop') || text.includes('one side of body')) {
      isEmergency = true;
      redFlagDetails.push('Sudden focal neurological deficits / potential stroke symptoms');
    }
    if (text.includes('difficulty breathing') && (text.includes('blue') || text.includes('gasping') || text.includes('cannot speak'))) {
      isEmergency = true;
      redFlagDetails.push('Severe acute respiratory distress');
    }
    if (text.includes('suicide') || text.includes('harm myself') || text.includes('kill myself')) {
      isEmergency = true;
      redFlagDetails.push('Immediate psychiatric safety concern');
    }

    // 2. Score Specialties
    const scored: Array<{ specialty: string; score: number; reasoning: string }> = [];

    for (const rule of SPECIALTY_RULES) {
      let score = 0;

      // Primary keywords (high weight)
      for (const kw of rule.primaryKeywords) {
        if (text.includes(kw)) {
          // Check word boundary or multi-word
          score += kw.includes(' ') ? 3.5 : 2.5;
        }
      }

      // Secondary keywords (moderate weight)
      for (const kw of rule.secondaryKeywords) {
        if (text.includes(kw)) {
          score += 1.0;
        }
      }

      // Negative keywords (penalty)
      if (rule.negativeKeywords) {
        for (const nkw of rule.negativeKeywords) {
          if (text.includes(nkw)) {
            score -= 1.5;
          }
        }
      }

      if (score > 0) {
        scored.push({
          specialty: rule.specialty,
          score,
          reasoning: rule.reasoningTemplate
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // 3. Clinical Disambiguation & Context Prioritization
    // E.g., Drowsiness / Daytime Sleepiness context
    const hasDrowsiness = text.includes('sleepy') || text.includes('sleepiness') || text.includes('drowsy') || text.includes('drowsiness') || text.includes('tired') || text.includes('fatigue');
    if (hasDrowsiness && !text.includes('joint') && !text.includes('knee') && !text.includes('bone')) {
      // Must NOT be Orthopedics! Ensure General Medicine is primary, Neurology secondary
      const gmIndex = scored.findIndex(s => s.specialty === 'General Medicine');
      if (gmIndex > 0) {
        const [gm] = scored.splice(gmIndex, 1);
        scored.unshift(gm);
      } else if (gmIndex === -1) {
        scored.unshift({
          specialty: 'General Medicine',
          score: 5.0,
          reasoning: SPECIALTY_RULES.find(r => r.specialty === 'General Medicine')!.reasoningTemplate
        });
      }

      // If chronic or apnea mentioned, add Neurology / Sleep as secondary option
      if (!scored.some(s => s.specialty === 'Neurology')) {
        scored.push({
          specialty: 'Neurology',
          score: 2.5,
          reasoning: 'Neurology / Sleep Medicine can evaluate central sleep disorders, narcolepsy, or neurological causes of excessive daytime sleepiness.'
        });
      }
    }

    // Default fallback if no keywords matched
    if (scored.length === 0) {
      scored.push({
        specialty: 'General Medicine',
        score: 1.0,
        reasoning: 'General Medicine / Internal Medicine is the recommended primary care starting point for initial clinical evaluation.'
      });
    }

    const topScore = Math.max(scored[0].score, 1);
    const allRecommendations: SpecialtyRecommendation[] = scored.map(s => ({
      specialty: s.specialty,
      confidence: Math.min(Math.round((s.score / topScore) * 95) / 100, 0.98),
      reasoning: s.reasoning,
      isEmergency: isEmergency && (s.specialty === 'Cardiology' || s.specialty === 'Neurology')
    }));

    const primarySpecialty = allRecommendations[0].specialty;
    const secondarySpecialties = allRecommendations.slice(1, 3);

    // Formulate a clean summary of the identified clinical issue
    const identifiedIssue = this.extractIdentifiedIssue(text, primarySpecialty);

    return {
      identifiedIssue,
      primarySpecialty,
      secondarySpecialties,
      allRecommendations,
      hasRedFlags: redFlagDetails.length > 0,
      redFlagDetails,
      suggestedTriageLevel: isEmergency ? 'EMERGENCY' : redFlagDetails.length > 0 ? 'URGENT' : 'ROUTINE'
    };
  }

  private extractIdentifiedIssue(text: string, primarySpecialty: string): string {
    if (text.includes('sleepy') || text.includes('drowsy') || text.includes('tired') || text.includes('fatigue')) {
      return 'Excessive daytime sleepiness and fatigue';
    }
    if (text.includes('knee')) {
      return 'Knee joint pain and mobility limitation';
    }
    if (text.includes('shoulder')) {
      return 'Shoulder joint pain and range of motion restriction';
    }
    if (text.includes('chest pain') || text.includes('palpitations') || text.includes('fluttering')) {
      return 'Chest discomfort or cardiovascular symptoms';
    }
    if (text.includes('rash') || text.includes('acne') || text.includes('skin') || text.includes('itch')) {
      return 'Dermatological skin lesion or rash';
    }
    if (text.includes('headache') || text.includes('migraine') || text.includes('dizzy')) {
      return 'Headache or neurological symptom evaluation';
    }
    if (text.includes('stomach') || text.includes('abdominal') || text.includes('cramps') || text.includes('digestion')) {
      return 'Gastrointestinal or abdominal discomfort';
    }
    if (text.includes('breathing') || text.includes('cough') || text.includes('asthma') || text.includes('wheez')) {
      return 'Respiratory or pulmonary symptoms';
    }
    if (text.includes('ear') || text.includes('throat') || text.includes('sinus') || text.includes('hearing')) {
      return 'Ear, nose, or throat symptoms';
    }
    if (text.includes('urine') || text.includes('urinary') || text.includes('bladder')) {
      return 'Urinary tract or urological concern';
    }
    if (text.includes('eye') || text.includes('vision') || text.includes('sight')) {
      return 'Ocular or visual symptom evaluation';
    }
    if (text.includes('child') || text.includes('baby') || text.includes('toddler')) {
      return 'Pediatric health consultation';
    }
    if (text.includes('period') || text.includes('menstrual') || text.includes('pregnancy')) {
      return 'Gynecological or reproductive health concern';
    }

    return `Consultation request for ${primarySpecialty}`;
  }
}

export const specialtyRecommendationService = new SpecialtyRecommendationService();
