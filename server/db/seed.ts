import { Database } from './database.js';
import { 
  Hospital, 
  Doctor, 
  Department,
  Specialty,
  HospitalAdmin,
  DoctorCalendar, 
  TimeSlot, 
  BlockedSlot, 
  Patient, 
  Questionnaire, 
  HealthcareSystemConnection, 
  ExternalIdentifierMapping 
} from '../types/entities.js';

export function seedDatabase(db: Database): void {
  // Reseed if hospitals < 4 or doctors < 15 to ensure complete multi-tenant dataset
  if (db.getHospitals().length >= 4 && db.getDoctors().length >= 15) {
    db.ensureFreshFutureSlots();
    return;
  }

  console.log('🌱 Seeding rich multi-hospital healthcare platform data with 17+ specialties...');

  // ==========================================
  // 1. HOSPITALS (Multi-tenant)
  // ==========================================
  const hosp1: Hospital = {
    id: 'hosp-1',
    name: 'City Central Hospital',
    slug: 'city-central',
    status: 'Approved',
    address: '742 Evergreen Terrace, Medical District, Metropolis',
    contactEmail: 'admin@citycentral.org',
    contactPhone: '+1-555-0100',
    operatingHours: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:00',
      closeTime: '20:00'
    },
    departments: ['Internal Medicine', 'Heart Center', 'Bone & Joint Care', 'Pulmonology Center', 'Gastroenterology Clinic'],
    specialties: ['General Medicine', 'Orthopedics', 'Cardiology', 'Pulmonology', 'Gastroenterology', 'Neurology'],
    supportedHealthcareSystems: ['Epic FHIR', 'Cerner HL7'],
    integrationConfig: {
      systemName: 'Epic Health Connector',
      endpointUrl: 'https://mock-epic.internal.citycentral.org/api/v2',
      apiVersion: 'R4',
      authType: 'Bearer',
      failureSimulationMode: 'NORMAL',
      enabled: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const hosp2: Hospital = {
    id: 'hosp-2',
    name: 'St. Jude Medical Center',
    slug: 'st-jude',
    status: 'Approved',
    address: '100 Mercy Boulevard, St. Jude Heights',
    contactEmail: 'contact@stjudemed.org',
    contactPhone: '+1-555-0200',
    operatingHours: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:30',
      closeTime: '18:30'
    },
    departments: ['Neuroscience Institute', 'Pediatric Pavilion', 'Dermatology & Skin Health', 'ENT & Otolaryngology', 'Orthopedic Surgery'],
    specialties: ['Neurology', 'Orthopedics', 'Dermatology', 'ENT', 'Pediatrics'],
    supportedHealthcareSystems: ['Cerner Millennium', 'Allscripts'],
    integrationConfig: {
      systemName: 'Cerner Direct Connector',
      endpointUrl: 'https://mock-cerner.stjudemed.org/api/fhir',
      apiVersion: 'R4',
      authType: 'Bearer',
      failureSimulationMode: 'NORMAL',
      enabled: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const hosp3: Hospital = {
    id: 'hosp-3',
    name: 'Metro Community Health Clinic',
    slug: 'metro-health',
    status: 'Approved',
    address: '450 North Broad Street, Metropolis',
    contactEmail: 'intake@metrohealth.org',
    contactPhone: '+1-555-0300',
    operatingHours: {
      days: [1, 2, 3, 4, 5],
      openTime: '09:00',
      closeTime: '18:00'
    },
    departments: ['Primary Care & Family Medicine', 'Cardiovascular Annex', 'Women\'s Reproductive Health', 'Urology Center', 'Behavioral Health & Psychiatry'],
    specialties: ['General Medicine', 'Cardiology', 'Gynecology', 'Urology', 'Psychiatry', 'Dermatology'],
    supportedHealthcareSystems: ['AthenaHealth FHIR'],
    integrationConfig: {
      systemName: 'Athena Connect',
      endpointUrl: 'https://mock-athena.metrohealth.org/api',
      apiVersion: 'v1',
      authType: 'ApiKey',
      failureSimulationMode: 'NORMAL',
      enabled: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const hosp4: Hospital = {
    id: 'hosp-4',
    name: 'Apex Specialty Care Hospital',
    slug: 'apex-specialty',
    status: 'Approved',
    address: '880 Westside Innovation Corridor, Metro West',
    contactEmail: 'contact@apexspecialtycare.org',
    contactPhone: '+1-555-0400',
    operatingHours: {
      days: [1, 2, 3, 4, 5],
      openTime: '08:00',
      closeTime: '17:00'
    },
    departments: ['Eye Institute', 'Endocrine & Metabolic Care', 'Nephrology & Renal Center', 'Rheumatology & Autoimmune Care', 'Physical Therapy & Rehab'],
    specialties: ['Ophthalmology', 'Endocrinology', 'Nephrology', 'Rheumatology', 'Physiotherapy'],
    supportedHealthcareSystems: ['Allscripts FHIR', 'Epic Connect'],
    integrationConfig: {
      systemName: 'Apex Health Gateway',
      endpointUrl: 'https://mock-gateway.apexspecialtycare.org/fhir',
      apiVersion: 'R4',
      authType: 'Bearer',
      failureSimulationMode: 'NORMAL',
      enabled: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.createHospital(hosp1);
  db.createHospital(hosp2);
  db.createHospital(hosp3);
  db.createHospital(hosp4);

  // Connections
  db.saveEhrConnection({
    id: 'conn-1',
    hospitalId: 'hosp-1',
    systemName: 'Epic Health Connector',
    status: 'Online',
    failureSimulationMode: 'NORMAL',
    lastPing: new Date().toISOString()
  });

  db.saveEhrConnection({
    id: 'conn-2',
    hospitalId: 'hosp-2',
    systemName: 'Cerner Direct Connector',
    status: 'Online',
    failureSimulationMode: 'NORMAL',
    lastPing: new Date().toISOString()
  });

  db.saveEhrConnection({
    id: 'conn-3',
    hospitalId: 'hosp-3',
    systemName: 'Athena Connect',
    status: 'Online',
    failureSimulationMode: 'NORMAL',
    lastPing: new Date().toISOString()
  });

  db.saveEhrConnection({
    id: 'conn-4',
    hospitalId: 'hosp-4',
    systemName: 'Apex Health Gateway',
    status: 'Online',
    failureSimulationMode: 'NORMAL',
    lastPing: new Date().toISOString()
  });

  // ==========================================
  // 2. DEPARTMENTS & HOSPITAL ADMINS
  // ==========================================
  const departments: Department[] = [
    // Hosp 1
    { id: 'dept-101', hospitalId: 'hosp-1', name: 'Internal Medicine', description: 'Primary adult care, diagnosis of multi-system issues, chronic illness care.', specialty: 'General Medicine' },
    { id: 'dept-102', hospitalId: 'hosp-1', name: 'Heart Center', description: 'Comprehensive cardiology, preventative cardiovascular assessment, telemetry.', specialty: 'Cardiology' },
    { id: 'dept-103', hospitalId: 'hosp-1', name: 'Bone & Joint Care', description: 'Orthopedic evaluation, joint reconstruction, sports medicine, trauma.', specialty: 'Orthopedics' },
    { id: 'dept-104', hospitalId: 'hosp-1', name: 'Pulmonology Center', description: 'Respiratory illness, asthma, COPD, and lung health diagnostics.', specialty: 'Pulmonology' },
    { id: 'dept-105', hospitalId: 'hosp-1', name: 'Gastroenterology Clinic', description: 'Digestive tract, endoscopy, liver disorders, reflux management.', specialty: 'Gastroenterology' },
    // Hosp 2
    { id: 'dept-201', hospitalId: 'hosp-2', name: 'Neuroscience Institute', description: 'Neurological evaluation, migraine management, EEG diagnostics.', specialty: 'Neurology' },
    { id: 'dept-202', hospitalId: 'hosp-2', name: 'Orthopedic Surgery', description: 'Joint replacement, spine care, extremity reconstruction.', specialty: 'Orthopedics' },
    { id: 'dept-203', hospitalId: 'hosp-2', name: 'Dermatology & Skin Health', description: 'Clinical dermatology, acne treatment, biopsy, eczema care.', specialty: 'Dermatology' },
    { id: 'dept-204', hospitalId: 'hosp-2', name: 'ENT & Otolaryngology', description: 'Ear, nose, throat, audiology, sinus surgery.', specialty: 'ENT' },
    { id: 'dept-205', hospitalId: 'hosp-2', name: 'Pediatric Pavilion', description: 'Infant, child, and adolescent wellness, immunizations, acute illness.', specialty: 'Pediatrics' },
    // Hosp 3
    { id: 'dept-301', hospitalId: 'hosp-3', name: 'Primary Care & Family Medicine', description: 'Comprehensive general health, preventive checkups, routine medical triage.', specialty: 'General Medicine' },
    { id: 'dept-302', hospitalId: 'hosp-3', name: 'Cardiovascular Annex', description: 'Outpatient cardiac checks, ECG, hypertension monitoring.', specialty: 'Cardiology' },
    { id: 'dept-303', hospitalId: 'hosp-3', name: 'Women\'s Reproductive Health', description: 'Gynecological exams, cycle disorders, pelvic health, family planning.', specialty: 'Gynecology' },
    { id: 'dept-304', hospitalId: 'hosp-3', name: 'Urology Center', description: 'Urinary tract health, bladder and kidney stone diagnostics.', specialty: 'Urology' },
    { id: 'dept-305', hospitalId: 'hosp-3', name: 'Behavioral Health & Psychiatry', description: 'Mental wellness, anxiety and depression management, therapy.', specialty: 'Psychiatry' },
    // Hosp 4
    { id: 'dept-401', hospitalId: 'hosp-4', name: 'Eye Institute', description: 'Comprehensive ophthalmology, vision testing, cataract assessment.', specialty: 'Ophthalmology' },
    { id: 'dept-402', hospitalId: 'hosp-4', name: 'Endocrine & Metabolic Care', description: 'Diabetes management, thyroid diagnostics, hormone balancing.', specialty: 'Endocrinology' },
    { id: 'dept-403', hospitalId: 'hosp-4', name: 'Nephrology & Renal Center', description: 'Kidney dysfunction, hypertension, dialysis management.', specialty: 'Nephrology' },
    { id: 'dept-404', hospitalId: 'hosp-4', name: 'Rheumatology & Autoimmune Care', description: 'Arthritis, lupus, joint inflammation, systemic autoimmune disease.', specialty: 'Rheumatology' },
    { id: 'dept-405', hospitalId: 'hosp-4', name: 'Physical Therapy & Rehab', description: 'Post-injury rehabilitation, mobility improvement, strengthening.', specialty: 'Physiotherapy' }
  ];

  departments.forEach(d => db.createDepartment(d));

  // Hospital Admins
  db.createHospitalAdmin({ id: 'hadmin-1', hospitalId: 'hosp-1', userId: 'user-admin-1', name: 'David Evans', email: 'admin@citycentral.org', role: 'HospitalAdmin', createdAt: new Date().toISOString() });
  db.createHospitalAdmin({ id: 'hadmin-2', hospitalId: 'hosp-2', userId: 'user-admin-2', name: 'Sister Beatrice', email: 'admin@stjudemed.org', role: 'HospitalAdmin', createdAt: new Date().toISOString() });
  db.createHospitalAdmin({ id: 'hadmin-3', hospitalId: 'hosp-3', userId: 'user-admin-3', name: 'Marcus Vance', email: 'admin@metrohealth.org', role: 'HospitalAdmin', createdAt: new Date().toISOString() });
  db.createHospitalAdmin({ id: 'hadmin-4', hospitalId: 'hosp-4', userId: 'user-admin-4', name: 'Claire Zhang', email: 'admin@apexspecialtycare.org', role: 'HospitalAdmin', createdAt: new Date().toISOString() });

  // ==========================================
  // 3. DOCTORS (DIFFERENT NAMES PER HOSPITAL!)
  // ==========================================
  const doctors: Doctor[] = [
    // HOSPITAL 1: City Central Hospital
    {
      id: 'doc-1', // Preserves test compatibility
      hospitalId: 'hosp-1',
      name: 'Dr. Robert Rao',
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
      specialty: 'Orthopedics',
      department: 'Bone & Joint Care',
      qualifications: ['MD', 'Board Certified Orthopedic Surgery', 'Fellow Sports Medicine'],
      experienceYears: 14,
      consultationFee: 180,
      languages: ['English', 'Hindi'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'EHR-PRV-RAO-901',
      status: 'Active',
      bio: 'Specialist in joint reconstruction, knee pathology, and sports injuries.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-2', // Preserves test compatibility
      hospitalId: 'hosp-1',
      name: 'Dr. Sarah Jenkins',
      photoUrl: 'https://images.unsplash.com/photo-1594824813588-4686414777c6?w=300&auto=format&fit=crop&q=80',
      specialty: 'Cardiology',
      department: 'Heart Center',
      qualifications: ['MD', 'FACC Cardiology Fellow', 'Board Certified Cardiovascular Disease'],
      experienceYears: 11,
      consultationFee: 220,
      languages: ['English', 'Spanish'],
      consultationTypes: ['in-person', 'video', 'telephone'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'EHR-PRV-JENK-442',
      status: 'Active',
      bio: 'Cardiologist focusing on arrhythmias, hypertension, and preventative cardiovascular health.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-ananya',
      hospitalId: 'hosp-1',
      name: 'Dr. Ananya Rao',
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80',
      specialty: 'General Medicine',
      department: 'Internal Medicine',
      qualifications: ['MD', 'Board Certified Internal Medicine'],
      experienceYears: 12,
      consultationFee: 140,
      languages: ['English', 'Hindi', 'Tamil'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'EHR-PRV-ANAN-102',
      status: 'Active',
      bio: 'Primary care physician specializing in chronic fatigue evaluation, systemic wellness, and diagnostic triage.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-shalini',
      hospitalId: 'hosp-1',
      name: 'Dr. Shalini Gupta',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
      specialty: 'Pulmonology',
      department: 'Pulmonology Center',
      qualifications: ['MD', 'Fellow College of Chest Physicians (FCCP)'],
      experienceYears: 15,
      consultationFee: 200,
      languages: ['English', 'Hindi'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'EHR-PRV-SHAL-331',
      status: 'Active',
      bio: 'Pulmonologist dedicated to asthma management, chronic cough diagnosis, and sleep-related breathing disorders.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-rajesh',
      hospitalId: 'hosp-1',
      name: 'Dr. Rajesh Verma',
      photoUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&auto=format&fit=crop&q=80',
      specialty: 'Gastroenterology',
      department: 'Gastroenterology Clinic',
      qualifications: ['MD', 'Fellow American Gastroenterological Association (AGAF)'],
      experienceYears: 18,
      consultationFee: 210,
      languages: ['English', 'Punjabi'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'EHR-PRV-RAJE-519',
      status: 'Active',
      bio: 'Consultant gastroenterologist specializing in reflux disorders, irritable bowel syndrome, and digestive health.',
      createdAt: new Date().toISOString()
    },

    // HOSPITAL 2: St. Jude Medical Center
    {
      id: 'doc-3', // Preserves test compatibility
      hospitalId: 'hosp-2',
      name: 'Dr. Elena Rostova',
      photoUrl: 'https://images.unsplash.com/photo-1594824813588-4686414777c6?w=300&auto=format&fit=crop&q=80',
      specialty: 'Neurology',
      department: 'Neuroscience Institute',
      qualifications: ['MD', 'PhD Neuroscience', 'Board Certified Neurology'],
      experienceYears: 16,
      consultationFee: 250,
      languages: ['English', 'Russian'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 45,
      externalProviderId: 'CERNER-PRV-ROST-118',
      status: 'Active',
      bio: 'Neurologist specializing in severe migraine, neuropathy, neurological sleep disturbances, and cognitive health.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-vikram',
      hospitalId: 'hosp-2',
      name: 'Dr. Vikram Singh',
      photoUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80',
      specialty: 'Orthopedics',
      department: 'Orthopedic Surgery',
      qualifications: ['MS Orthopedics', 'FRCS Glasgow', 'Fellow Arthroplasty'],
      experienceYears: 17,
      consultationFee: 190,
      languages: ['English', 'Hindi'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'CERNER-PRV-VIKR-401',
      status: 'Active',
      bio: 'Orthopedic surgeon focusing on knee replacement, arthroscopy, and complex ligament injuries.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-sneha',
      hospitalId: 'hosp-2',
      name: 'Dr. Sneha Patel',
      photoUrl: 'https://images.unsplash.com/photo-1623854767648-e7bb8009f0db?w=300&auto=format&fit=crop&q=80',
      specialty: 'Dermatology',
      department: 'Dermatology & Skin Health',
      qualifications: ['MD Dermatology', 'Fellow American Academy of Dermatology'],
      experienceYears: 10,
      consultationFee: 160,
      languages: ['English', 'Gujarati'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 20,
      externalProviderId: 'CERNER-PRV-SNEH-224',
      status: 'Active',
      bio: 'Dermatologist treating inflammatory skin rashes, psoriasis, eczema, acne, and skin allergies.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-daniel',
      hospitalId: 'hosp-2',
      name: 'Dr. Daniel Cho',
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
      specialty: 'ENT',
      department: 'ENT & Otolaryngology',
      qualifications: ['MD', 'Board Certified Otolaryngology'],
      experienceYears: 13,
      consultationFee: 175,
      languages: ['English', 'Korean'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'CERNER-PRV-DANI-661',
      status: 'Active',
      bio: 'ENT specialist treating sinus pressure, chronic ear pain, hearing disorders, and throat pathology.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-anita',
      hospitalId: 'hosp-2',
      name: 'Dr. Anita Desai',
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80',
      specialty: 'Pediatrics',
      department: 'Pediatric Pavilion',
      qualifications: ['MD Pediatrics', 'FAAP Fellow American Academy of Pediatrics'],
      experienceYears: 14,
      consultationFee: 150,
      languages: ['English', 'Marathi'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'CERNER-PRV-ANIT-808',
      status: 'Active',
      bio: 'Compassionate pediatrician focusing on infant wellness, pediatric development, and acute childhood illnesses.',
      createdAt: new Date().toISOString()
    },

    // HOSPITAL 3: Metro Community Health Clinic
    {
      id: 'doc-meera',
      hospitalId: 'hosp-3',
      name: 'Dr. Meera Nair',
      photoUrl: 'https://images.unsplash.com/photo-1594824813588-4686414777c6?w=300&auto=format&fit=crop&q=80',
      specialty: 'General Medicine',
      department: 'Primary Care & Family Medicine',
      qualifications: ['MD Family Medicine', 'Board Certified General Practitioner'],
      experienceYears: 15,
      consultationFee: 110,
      languages: ['English', 'Malayalam'],
      consultationTypes: ['in-person', 'video', 'telephone'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'ATHENA-PRV-MEER-190',
      status: 'Active',
      bio: 'Dedicated primary care physician providing holistic assessments for fatigue, daytime sleepiness, and lifestyle medicine.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-karthik',
      hospitalId: 'hosp-3',
      name: 'Dr. Karthik Rao',
      photoUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&auto=format&fit=crop&q=80',
      specialty: 'Cardiology',
      department: 'Cardiovascular Annex',
      qualifications: ['MD Cardiology', 'FESC European Society of Cardiology'],
      experienceYears: 13,
      consultationFee: 180,
      languages: ['English', 'Kannada'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'ATHENA-PRV-KART-712',
      status: 'Active',
      bio: 'Clinical cardiologist specializing in palpitations, blood pressure control, and outpatient cardiovascular wellness.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-kavita',
      hospitalId: 'hosp-3',
      name: 'Dr. Kavita Krishnan',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
      specialty: 'Gynecology',
      department: 'Women\'s Reproductive Health',
      qualifications: ['MD Obstetrics & Gynecology', 'FACOG Fellow'],
      experienceYears: 16,
      consultationFee: 165,
      languages: ['English', 'Tamil'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'ATHENA-PRV-KAVI-338',
      status: 'Active',
      bio: 'Gynecologist specializing in menstrual irregularity, pelvic pain, reproductive health, and wellness screenings.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-suresh',
      hospitalId: 'hosp-3',
      name: 'Dr. Suresh Menon',
      photoUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80',
      specialty: 'Urology',
      department: 'Urology Center',
      qualifications: ['MCh Urology', 'Fellow American Urological Association'],
      experienceYears: 19,
      consultationFee: 195,
      languages: ['English', 'Malayalam'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'ATHENA-PRV-SURE-914',
      status: 'Active',
      bio: 'Urologist evaluating urinary symptoms, bladder health, kidney stone prevention, and prostate wellness.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-maya',
      hospitalId: 'hosp-3',
      name: 'Dr. Maya Lin',
      photoUrl: 'https://images.unsplash.com/photo-1623854767648-e7bb8009f0db?w=300&auto=format&fit=crop&q=80',
      specialty: 'Psychiatry',
      department: 'Behavioral Health & Psychiatry',
      qualifications: ['MD Psychiatry', 'Board Certified Adult Psychiatry'],
      experienceYears: 11,
      consultationFee: 210,
      languages: ['English', 'Mandarin'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 45,
      externalProviderId: 'ATHENA-PRV-MAYA-440',
      status: 'Active',
      bio: 'Psychiatrist offering compassionate support for anxiety, mood disorders, insomnia, and stress management.',
      createdAt: new Date().toISOString()
    },

    // HOSPITAL 4: Apex Specialty Care
    {
      id: 'doc-farhan',
      hospitalId: 'hosp-4',
      name: 'Dr. Farhan Akhtar',
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
      specialty: 'Ophthalmology',
      department: 'Eye Institute',
      qualifications: ['MD Ophthalmology', 'FACS Fellow American College of Surgeons'],
      experienceYears: 14,
      consultationFee: 170,
      languages: ['English', 'Urdu'],
      consultationTypes: ['in-person'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'APEX-PRV-FARH-502',
      status: 'Active',
      bio: 'Ophthalmologist providing comprehensive visual evaluations, cataract management, and anterior segment care.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-sunita',
      hospitalId: 'hosp-4',
      name: 'Dr. Sunita Rao',
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80',
      specialty: 'Endocrinology',
      department: 'Endocrine & Metabolic Care',
      qualifications: ['MD Endocrinology', 'Fellow Endocrine Society'],
      experienceYears: 13,
      consultationFee: 195,
      languages: ['English', 'Telugu'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'APEX-PRV-SUNI-227',
      status: 'Active',
      bio: 'Endocrinologist specializing in diabetes optimization, thyroid disorders, and metabolic health.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-david',
      hospitalId: 'hosp-4',
      name: 'Dr. David Miller',
      photoUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&auto=format&fit=crop&q=80',
      specialty: 'Nephrology',
      department: 'Nephrology & Renal Center',
      qualifications: ['MD Nephrology', 'FASN Fellow American Society of Nephrology'],
      experienceYears: 20,
      consultationFee: 225,
      languages: ['English'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 45,
      externalProviderId: 'APEX-PRV-DAVI-113',
      status: 'Active',
      bio: 'Senior nephrologist focusing on renal preservation, chronic kidney care, and resistant hypertension.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-preeti',
      hospitalId: 'hosp-4',
      name: 'Dr. Preeti Joshi',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
      specialty: 'Rheumatology',
      department: 'Rheumatology & Autoimmune Care',
      qualifications: ['MD Rheumatology', 'Fellow American College of Rheumatology'],
      experienceYears: 12,
      consultationFee: 190,
      languages: ['English', 'Hindi'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 30,
      externalProviderId: 'APEX-PRV-PREE-991',
      status: 'Active',
      bio: 'Rheumatologist specializing in autoimmune joint inflammation, rheumatoid arthritis, and lupus.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'doc-rohan',
      hospitalId: 'hosp-4',
      name: 'Dr. Rohan Kapoor',
      photoUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80',
      specialty: 'Physiotherapy',
      department: 'Physical Therapy & Rehab',
      qualifications: ['MPT Musculoskeletal', 'Certified Orthopedic Manual Therapist'],
      experienceYears: 9,
      consultationFee: 95,
      languages: ['English', 'Hindi'],
      consultationTypes: ['in-person', 'video'],
      appointmentDurationMinutes: 45,
      externalProviderId: 'APEX-PRV-ROHA-603',
      status: 'Active',
      bio: 'Physiotherapist dedicated to spine rehabilitation, sports injury recovery, and mobility restoration.',
      createdAt: new Date().toISOString()
    }
  ];

  doctors.forEach(doc => db.createDoctor(doc));

  // Identifier Mappings
  doctors.forEach(doc => {
    db.saveIdentifierMapping({
      id: `map-${doc.id}`,
      hospitalId: doc.hospitalId,
      entityType: 'Doctor',
      internalId: doc.id,
      externalId: doc.externalProviderId,
      externalSystemName: doc.hospitalId === 'hosp-1' ? 'Epic Health Connector' : doc.hospitalId === 'hosp-2' ? 'Cerner Direct Connector' : 'Mock EHR',
      createdAt: new Date().toISOString()
    });
  });

  // Doctor Calendars & Slots (Next 7 days, Mon-Fri 09:00 - 17:00)
  const workingHoursStandard = [1, 2, 3, 4, 5].map(day => ({
    dayOfWeek: day,
    startTime: '09:00',
    endTime: '17:00',
    breakStartTime: '13:00',
    breakEndTime: '14:00'
  }));

  doctors.forEach(doc => {
    db.saveDoctorCalendar({
      id: `cal-${doc.id}`,
      doctorId: doc.id,
      hospitalId: doc.hospitalId,
      workingHours: workingHoursStandard,
      slotDurationMinutes: doc.appointmentDurationMinutes || 30,
      bufferMinutes: 0,
      isActive: true
    });
  });

  // Generate Slots dynamically for next 7 days
  const now = new Date();
  const generatedSlots: TimeSlot[] = [];

  doctors.forEach(doc => {
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + dayOffset);
      const dayOfWeek = targetDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekend

      const dateStr = targetDate.toISOString().split('T')[0];
      const hours = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];

      hours.forEach((h, idx) => {
        const [hour, min] = h.split(':').map(Number);
        const start = new Date(targetDate);
        start.setHours(hour, min, 0, 0);

        const end = new Date(start);
        end.setMinutes(start.getMinutes() + doc.appointmentDurationMinutes);

        // Pre-reserve 1 slot on day 1 for testing occupied slots
        const isBooked = dayOffset === 1 && idx === 0 && doc.id === 'doc-1';

        generatedSlots.push({
          id: `slot-${doc.id}-${dateStr}-${h.replace(':', '')}`,
          doctorId: doc.id,
          hospitalId: doc.hospitalId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          isAvailable: !isBooked,
          appointmentId: isBooked ? 'appt-pre-existing' : undefined
        });
      });
    }
  });

  db.saveSlots(generatedSlots);

  // Blocked slots for Dr. Robert Rao (Surgery Rounds)
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const blockStart = new Date(tomorrow);
  blockStart.setHours(11, 0, 0, 0);
  const blockEnd = new Date(tomorrow);
  blockEnd.setHours(12, 0, 0, 0);

  db.addBlockedSlot({
    id: 'block-1',
    doctorId: 'doc-1',
    hospitalId: 'hosp-1',
    startTime: blockStart.toISOString(),
    endTime: blockEnd.toISOString(),
    reason: 'Departmental Surgery Rounds',
    createdAt: new Date().toISOString()
  });

  // ==========================================
  // 4. PATIENTS
  // ==========================================
  const pat1: Patient = {
    id: 'pat-1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+15550199',
    dateOfBirth: '1985-04-12',
    preferredCommunication: 'SMS',
    preferredTimeOfDay: 'afternoon',
    externalPatientId: 'EHR-PAT-10992',
    createdAt: new Date().toISOString()
  };

  const pat2: Patient = {
    id: 'pat-2',
    name: 'Emily Chen',
    email: 'emily.chen@example.com',
    phone: '+15550144',
    dateOfBirth: '1992-09-23',
    preferredCommunication: 'Email',
    preferredTimeOfDay: 'morning',
    externalPatientId: 'EHR-PAT-88314',
    createdAt: new Date().toISOString()
  };

  db.savePatient(pat1);
  db.savePatient(pat2);

  db.saveIdentifierMapping({
    id: 'map-pat-1',
    hospitalId: 'hosp-1',
    entityType: 'Patient',
    internalId: 'pat-1',
    externalId: 'EHR-PAT-10992',
    externalSystemName: 'Epic Health Connector',
    createdAt: new Date().toISOString()
  });

  // ==========================================
  // 5. PRE-VISIT QUESTIONNAIRES (Context-Specific)
  // ==========================================
  const gmQuestionnaire: Questionnaire = {
    id: 'quest-gm-1',
    hospitalId: 'hosp-1',
    specialty: 'General Medicine',
    title: 'Pre-Visit General Medicine & Fatigue Intake',
    description: 'Clinical pre-assessment to evaluate daytime drowsiness, fatigue, sleep schedule, and general health indicators.',
    isActive: true,
    questions: [
      {
        id: 'q1_duration',
        question: 'How long have you been experiencing this sleepiness or fatigue?',
        type: 'choice',
        required: true,
        options: ['Less than 1 week', '1 to 2 weeks', '2 to 4 weeks', 'More than a month']
      },
      {
        id: 'q2_sleep_hours',
        question: 'How many hours do you usually sleep at night?',
        type: 'choice',
        required: true,
        options: ['Fewer than 5 hours', '5 to 6 hours', '7 to 8 hours', 'More than 8 hours']
      },
      {
        id: 'q3_unrefreshed',
        question: 'Do you feel sleepy during the daytime even after what feels like adequate sleep?',
        type: 'yes_no',
        required: true
      },
      {
        id: 'q4_schedule_change',
        question: 'Has your sleep schedule, work shift, or stress level changed recently?',
        type: 'yes_no',
        required: true
      },
      {
        id: 'q5_associated_symptoms',
        question: 'Are you experiencing weakness, dizziness, headaches, or difficulty concentrating?',
        type: 'choice',
        required: true,
        options: ['None of these', 'Morning headaches', 'Dizziness', 'Difficulty concentrating', 'General weakness']
      },
      {
        id: 'q6_medications',
        question: 'Are you currently taking any prescription medications, sedatives, or over-the-counter drugs?',
        type: 'short_text',
        required: false
      },
      {
        id: 'q7_red_flag_safety',
        question: 'Has this fatigue or drowsiness caused you to fall asleep while driving or operating machinery?',
        type: 'yes_no',
        required: true,
        isRedFlagIndicator: true
      }
    ],
    createdAt: new Date().toISOString()
  };

  const orthoQuestionnaire: Questionnaire = {
    id: 'quest-ortho-1',
    hospitalId: 'hosp-1',
    specialty: 'Orthopedics',
    title: 'Pre-Visit Orthopedic & Joint Intake',
    description: 'Comprehensive musculoskeletal evaluation to assess joint pain, mobility restriction, and prior injuries.',
    isActive: true,
    questions: [
      {
        id: 'q1_red_flag',
        question: 'Are you experiencing severe numbness, loss of bladder/bowel control, or high fever with joint swelling?',
        type: 'yes_no',
        required: true,
        isRedFlagIndicator: true
      },
      {
        id: 'q2_joint_location',
        question: 'Which joint or region is causing you discomfort?',
        type: 'choice',
        required: true,
        options: ['Right Knee', 'Left Knee', 'Both Knees', 'Left Shoulder', 'Right Shoulder', 'Hip', 'Spine / Back', 'Ankle']
      },
      {
        id: 'q3_pain_scale',
        question: 'On a scale of 1 (mild) to 10 (unbearable), how would you rate your current pain?',
        type: 'numeric',
        required: true,
        validation: { min: 1, max: 10 }
      },
      {
        id: 'q4_onset_injury',
        question: 'Did this symptom begin following a specific sports injury, fall, or accident?',
        type: 'yes_no',
        required: true
      },
      {
        id: 'q5_walking_difficulty',
        question: 'Is the discomfort significantly worse while walking, bearing weight, or climbing stairs?',
        type: 'yes_no',
        required: true
      }
    ],
    createdAt: new Date().toISOString()
  };

  const cardioQuestionnaire: Questionnaire = {
    id: 'quest-cardio-1',
    hospitalId: 'hosp-1',
    specialty: 'Cardiology',
    title: 'Pre-Visit Cardiology Symptom Screening',
    description: 'Cardiovascular screening questionnaire to evaluate chest sensations, palpitations, and exertion tolerance.',
    isActive: true,
    questions: [
      {
        id: 'q1_cardio_red_flag',
        question: 'Are you experiencing active crushing chest pressure radiating to your jaw or left arm right now?',
        type: 'yes_no',
        required: true,
        isRedFlagIndicator: true
      },
      {
        id: 'q2_primary_symptom',
        question: 'What is your primary reason for visiting cardiology?',
        type: 'choice',
        required: true,
        options: ['Heart Palpitations / Fluttering', 'Shortness of Breath on Exertion', 'High Blood Pressure Check', 'Dizziness / Lightheadedness', 'Preventative Family Check']
      },
      {
        id: 'q3_hypertension_history',
        question: 'Do you have a personal history of hypertension or take blood pressure medications?',
        type: 'yes_no',
        required: true
      }
    ],
    createdAt: new Date().toISOString()
  };

  const neuroQuestionnaire: Questionnaire = {
    id: 'quest-neuro-1',
    hospitalId: 'hosp-2',
    specialty: 'Neurology',
    title: 'Pre-Visit Neurology Symptom Assessment',
    description: 'Pre-consultation neurological questionnaire for Dr. Elena Rostova.',
    isActive: true,
    questions: [
      {
        id: 'q1_neuro_red_flag',
        question: 'Are you experiencing a sudden severe headache, sudden vision loss, difficulty speaking, or weakness on one side of your body?',
        type: 'yes_no',
        required: true,
        isRedFlagIndicator: true
      },
      {
        id: 'q2_primary_neuro_symptom',
        question: 'What is your primary reason for visiting neurology?',
        type: 'choice',
        required: true,
        options: ['Chronic Headaches / Migraines', 'Numbness or Tingling', 'Dizziness / Balance Issues', 'Seizures / Epilepsy', 'Memory / Cognitive Concerns', 'Nerve Pain / Neuropathy']
      },
      {
        id: 'q3_symptom_duration',
        question: 'How long have you been experiencing these symptoms?',
        type: 'choice',
        required: true,
        options: ['Less than 1 week', '1 to 4 weeks', '1 to 6 months', 'Over 6 months']
      }
    ],
    createdAt: new Date().toISOString()
  };

  const dermQuestionnaire: Questionnaire = {
    id: 'quest-derm-1',
    hospitalId: 'hosp-2',
    specialty: 'Dermatology',
    title: 'Pre-Visit Dermatology Skin Intake',
    description: 'Screening questionnaire for skin rashes, lesions, and dermatological conditions for Dr. Sneha Patel.',
    isActive: true,
    questions: [
      {
        id: 'q1_body_location',
        question: 'Where on your body is the rash or lesion located?',
        type: 'choice',
        required: true,
        options: ['Face / Scalp', 'Arms / Hands', 'Legs / Feet', 'Torso / Back / Chest', 'Widespread across body']
      },
      {
        id: 'q2_duration',
        question: 'When did the rash or lesion first appear?',
        type: 'choice',
        required: true,
        options: ['Past 24 hours', '1 to 7 days ago', '1 to 4 weeks ago', 'Over a month ago']
      },
      {
        id: 'q3_sensations',
        question: 'Is the affected area intensely itchy, burning, painful, or bleeding?',
        type: 'choice',
        required: true,
        options: ['Intensely itchy', 'Painful / tender', 'Burning sensation', 'Asymptomatic']
      },
      {
        id: 'q4_red_flag',
        question: 'Is the skin condition accompanied by high fever or difficulty breathing?',
        type: 'yes_no',
        required: true,
        isRedFlagIndicator: true
      }
    ],
    createdAt: new Date().toISOString()
  };

  db.saveQuestionnaire(gmQuestionnaire);
  db.saveQuestionnaire(orthoQuestionnaire);
  db.saveQuestionnaire(cardioQuestionnaire);
  db.saveQuestionnaire(neuroQuestionnaire);
  db.saveQuestionnaire(dermQuestionnaire);

  // Initial audit event
  db.logAuditEvent({
    id: 'audit-init-seed',
    actorRole: 'SYSTEM',
    actorId: 'system-bootstrap',
    action: 'PLATFORM_MULTI_TENANT_DATA_SEEDED',
    entityType: 'Platform',
    entityId: 'platform-1',
    details: { hospitals: 4, doctors: doctors.length, specialties: 17, departments: departments.length },
    timestamp: new Date().toISOString()
  });

  console.log('✅ Multi-hospital & multi-specialty seed completed successfully!');
}
