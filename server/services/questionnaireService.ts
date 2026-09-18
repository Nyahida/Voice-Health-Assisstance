import { Questionnaire, QuestionItem, QuestionnaireResponse } from '../types/entities.js';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';

/**
 * Context-Aware Pre-Visit Intake Questionnaire Service
 * Dynamically selects or generates clinically relevant questions based on
 * the patient's reported symptoms and recommended specialty.
 */
export class QuestionnaireService {
  /**
   * Generates or selects an appropriate pre-visit questionnaire for a given specialty & concern.
   */
  public getOrCreateContextualQuestionnaire(params: {
    hospitalId: string;
    specialty: string;
    healthConcern: string;
    doctorId?: string;
  }): Questionnaire {
    const { hospitalId, specialty, healthConcern, doctorId } = params;
    const normSpec = specialty.toLowerCase();
    const concernText = healthConcern.toLowerCase();

    // 1. Check if an exact template already exists in database
    const existing = db.getQuestionnaires(hospitalId).find(q => 
      q.specialty?.toLowerCase() === normSpec && q.isActive
    );

    // If existing matches, but we need symptom-specific customization:
    const questions = this.buildContextualQuestions(specialty, concernText);

    if (existing && existing.questions.length >= questions.length) {
      return existing;
    }

    // Otherwise create or return dynamically generated clinical questionnaire
    const id = `quest-${normSpec.replace(/\s+/g, '-')}-${uuidv4().substring(0, 6)}`;
    const newQuestionnaire: Questionnaire = {
      id,
      hospitalId,
      specialty,
      doctorId,
      title: `Pre-Visit ${specialty} Intake — ${this.formatTitle(healthConcern)}`,
      description: `Please complete this context-specific clinical intake to prepare your chart for your ${specialty} consultation regarding ${healthConcern}.`,
      questions,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    db.saveQuestionnaire(newQuestionnaire);
    return newQuestionnaire;
  }

  /**
   * Generates clinically specific questions tailored to the reported concern and specialty.
   */
  private buildContextualQuestions(specialty: string, concern: string): QuestionItem[] {
    const spec = specialty.toLowerCase();
    const c = concern.toLowerCase();

    // 1. DROWSINESS / FATIGUE / SLEEPINESS (General Medicine / Sleep)
    if (c.includes('sleep') || c.includes('drowsy') || c.includes('tired') || c.includes('fatigue')) {
      return [
        {
          id: 'q1_duration',
          question: 'How long have you been experiencing excessive daytime sleepiness or fatigue?',
          type: 'choice',
          required: true,
          options: ['Less than 1 week', '1 to 2 weeks', '2 to 4 weeks', '1 to 3 months', 'Over 3 months']
        },
        {
          id: 'q2_sleep_hours',
          question: 'On average, how many hours do you usually sleep at night?',
          type: 'choice',
          required: true,
          options: ['Fewer than 5 hours', '5 to 6 hours', '7 to 8 hours', 'More than 9 hours']
        },
        {
          id: 'q3_unrefreshed',
          question: 'Do you feel sleepy during the daytime even after what feels like an adequate night of sleep?',
          type: 'yes_no',
          required: true
        },
        {
          id: 'q4_schedule_change',
          question: 'Has your work shift, sleep schedule, or stress level changed recently?',
          type: 'yes_no',
          required: true
        },
        {
          id: 'q5_associated_symptoms',
          question: 'Are you experiencing weakness, dizziness, morning headaches, or difficulty concentrating?',
          type: 'choice',
          required: true,
          options: ['None of these', 'Morning headaches', 'Dizziness / lightheadedness', 'Difficulty concentrating', 'Muscle weakness']
        },
        {
          id: 'q6_medications',
          question: 'Are you taking any medications, supplements, or sedatives that might cause drowsiness?',
          type: 'short_text',
          required: false
        },
        {
          id: 'q7_driving_safety',
          question: 'Has this sleepiness ever affected your driving, operation of machinery, or caused you to fall asleep unexpectedly?',
          type: 'yes_no',
          required: true,
          isRedFlagIndicator: true
        }
      ];
    }

    // 2. KNEE / JOINT PAIN (Orthopedics)
    if (c.includes('knee') || (c.includes('joint') && !c.includes('shoulder')) || spec === 'orthopedics') {
      return [
        {
          id: 'q1_location',
          question: 'Where exactly is the pain or limitation located?',
          type: 'choice',
          required: true,
          options: ['Right Knee', 'Left Knee', 'Both Knees', 'Hip', 'Ankle / Foot', 'Shoulder', 'Lower Back']
        },
        {
          id: 'q2_onset',
          question: 'When did the pain or swelling start?',
          type: 'choice',
          required: true,
          options: ['Within the last 48 hours', '1 to 2 weeks ago', '1 to 3 months ago', 'Chronic / Over 6 months']
        },
        {
          id: 'q3_injury_history',
          question: 'Was there a specific traumatic injury, fall, sports incident, or twisting motion?',
          type: 'yes_no',
          required: true
        },
        {
          id: 'q4_swelling',
          question: 'Is there visible swelling, warmth, redness, or fluid accumulation around the joint?',
          type: 'yes_no',
          required: true
        },
        {
          id: 'q5_weight_bearing',
          question: 'Is the pain significantly worse while walking, bearing weight, or negotiating stairs?',
          type: 'yes_no',
          required: true
        },
        {
          id: 'q6_instability_locking',
          question: 'Does the joint buckle, give way, click loudly, or lock in place?',
          type: 'choice',
          required: true,
          options: ['No instability', 'Occasional clicking/popping', 'Joint gives way/buckles', 'Joint physically locks']
        },
        {
          id: 'q7_red_flag_infection',
          question: 'Are you experiencing high fever, chills, inability to bear any weight, or severe radiating numbness?',
          type: 'yes_no',
          required: true,
          isRedFlagIndicator: true
        }
      ];
    }

    // 3. CHEST PAIN / PALPITATIONS (Cardiology)
    if (spec === 'cardiology' || c.includes('chest') || c.includes('palpitation') || c.includes('heart')) {
      return [
        {
          id: 'q1_cardio_emergency',
          question: 'Are you experiencing active crushing pressure radiating to your jaw, left arm, or back right now?',
          type: 'yes_no',
          required: true,
          isRedFlagIndicator: true
        },
        {
          id: 'q2_onset',
          question: 'When did you first notice this discomfort or flutter?',
          type: 'choice',
          required: true,
          options: ['Started today', 'Past few days', 'Past 2-4 weeks', 'Intermittent over several months']
        },
        {
          id: 'q3_pattern',
          question: 'Is the symptom continuous or intermittent (comes and goes)?',
          type: 'choice',
          required: true,
          options: ['Continuous', 'Intermittent with exertion', 'Intermittent at rest', 'Triggered by stress / caffeine']
        },
        {
          id: 'q4_associated_symptoms',
          question: 'Do you experience shortness of breath, sweating, nausea, or lightheadedness when it occurs?',
          type: 'choice',
          required: true,
          options: ['None of these', 'Shortness of breath', 'Sweating / clamminess', 'Dizziness / near-fainting']
        },
        {
          id: 'q5_history',
          question: 'Do you have a personal history of high blood pressure, elevated cholesterol, or heart disease?',
          type: 'yes_no',
          required: true
        }
      ];
    }

    // 4. SKIN RASH / LESIONS (Dermatology)
    if (spec === 'dermatology' || c.includes('rash') || c.includes('skin') || c.includes('acne') || c.includes('itch')) {
      return [
        {
          id: 'q1_body_location',
          question: 'Where on your body is the rash, lesion, or skin irritation located?',
          type: 'choice',
          required: true,
          options: ['Face / Scalp', 'Arms / Hands', 'Legs / Feet', 'Torso / Back / Chest', 'Widespread across body']
        },
        {
          id: 'q2_onset',
          question: 'When did the rash or lesion first appear, and is it spreading?',
          type: 'choice',
          required: true,
          options: ['Appeared within 24 hours', '1 to 7 days ago', '1 to 4 weeks ago', 'Over a month ago']
        },
        {
          id: 'q3_sensations',
          question: 'Is the affected area itchy, painful, burning, or bleeding?',
          type: 'choice',
          required: true,
          options: ['Intensely itchy', 'Painful / tender', 'Burning sensation', 'Asymptomatic / cosmetic concern']
        },
        {
          id: 'q4_triggers',
          question: 'Have you been exposed to new soaps, detergents, cosmetics, outdoor plants, or started new medications?',
          type: 'yes_no',
          required: true
        },
        {
          id: 'q5_systemic_red_flag',
          question: 'Is the skin condition accompanied by high fever, blistering inside the mouth/eyes, or difficulty breathing?',
          type: 'yes_no',
          required: true,
          isRedFlagIndicator: true
        }
      ];
    }

    // 5. EAR, NOSE & THROAT (ENT)
    if (spec === 'ent' || c.includes('ear') || c.includes('throat') || c.includes('sinus') || c.includes('hearing')) {
      return [
        {
          id: 'q1_ent_primary',
          question: 'What is your primary symptom?',
          type: 'choice',
          required: true,
          options: ['Ear pain / discharge', 'Hearing loss / tinnitus', 'Severe sore throat', 'Sinus pressure / nasal obstruction', 'Hoarseness / voice change']
        },
        {
          id: 'q2_duration',
          question: 'How long have you had this symptom?',
          type: 'choice',
          required: true,
          options: ['Less than 3 days', '3 to 10 days', '2 to 4 weeks', 'More than a month']
        },
        {
          id: 'q3_swallowing_difficulty',
          question: 'Are you experiencing severe difficulty swallowing saliva, inability to open your mouth, or stridor (noisy breathing)?',
          type: 'yes_no',
          required: true,
          isRedFlagIndicator: true
        }
      ];
    }

    // 6. GASTROINTESTINAL (Gastroenterology)
    if (spec === 'gastroenterology' || c.includes('stomach') || c.includes('abdominal') || c.includes('digestion') || c.includes('acid')) {
      return [
        {
          id: 'q1_gi_location',
          question: 'Where is the abdominal discomfort located?',
          type: 'choice',
          required: true,
          options: ['Upper abdomen / under ribs', 'Lower right abdomen', 'Lower left abdomen', 'Around the navel / general cramps']
        },
        {
          id: 'q2_relation_to_meals',
          question: 'Is the discomfort worse before eating, immediately after eating, or during the night?',
          type: 'choice',
          required: true,
          options: ['Worse after meals', 'Relieved by food', 'Worse at night lying flat', 'Constant / unrelated to food']
        },
        {
          id: 'q3_red_flag_bleeding',
          question: 'Have you noticed vomiting blood, black tarry stools, unexplained rapid weight loss, or high fever with rigid abdomen?',
          type: 'yes_no',
          required: true,
          isRedFlagIndicator: true
        }
      ];
    }

    // 7. RESPIRATORY (Pulmonology)
    if (spec === 'pulmonology' || c.includes('breathing') || c.includes('cough') || c.includes('asthma')) {
      return [
        {
          id: 'q1_pulm_symptom',
          question: 'What is your main respiratory difficulty?',
          type: 'choice',
          required: true,
          options: ['Shortness of breath on mild exertion', 'Persistent dry cough', 'Productive cough with phlegm', 'Wheezing / chest tightness']
        },
        {
          id: 'q2_duration',
          question: 'How long have you had this cough or breathing difficulty?',
          type: 'choice',
          required: true,
          options: ['Less than 1 week', '1 to 3 weeks', '3 to 8 weeks', 'Over 8 weeks (chronic)']
        },
        {
          id: 'q3_red_flag_hemoptysis',
          question: 'Are you coughing up blood, experiencing blue discoloration of lips, or unable to speak full sentences?',
          type: 'yes_no',
          required: true,
          isRedFlagIndicator: true
        }
      ];
    }

    // DEFAULT GENERAL MEDICINE CLINICAL INTAKE
    return [
      {
        id: 'q1_primary_concern',
        question: 'Please describe the main symptom or reason for your clinical visit today:',
        type: 'short_text',
        required: true
      },
      {
        id: 'q2_duration',
        question: 'When did you first notice these symptoms?',
        type: 'choice',
        required: true,
        options: ['Within past 48 hours', '1 to 2 weeks ago', '2 to 4 weeks ago', 'More than a month ago']
      },
      {
        id: 'q3_severity',
        question: 'On a scale of 1 (mild) to 10 (severe), how significantly does this affect your daily routine?',
        type: 'choice',
        required: true,
        options: ['1-3 (Mild)', '4-6 (Moderate limitation)', '7-8 (Severe limitation)', '9-10 (Unable to function)']
      },
      {
        id: 'q4_medications',
        question: 'Are you currently taking any prescription medications or over-the-counter drugs?',
        type: 'short_text',
        required: false
      },
      {
        id: 'q5_red_flag',
        question: 'Are you experiencing any sudden severe pain, high fever, fainting, or difficulty breathing?',
        type: 'yes_no',
        required: true,
        isRedFlagIndicator: true
      }
    ];
  }

  private formatTitle(text: string): string {
    if (!text) return 'Clinical Intake';
    const words = text.split(' ').slice(0, 5);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}

export const questionnaireService = new QuestionnaireService();
