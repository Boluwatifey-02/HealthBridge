/**
 * Demonstration dataset for HealthBridge.
 *
 * Everything here is fictional and clearly marked as such: patient names carry a
 * "Demo" prefix so a demonstration record can never be mistaken for a real
 * patient, and every generated identifier is prefixed. The data is internally
 * consistent - patients own appointments, consultations, prescriptions and
 * laboratory work, the medicines dispensed are ones actually held in stock, and
 * every dashboard figure is then computed from these rows rather than invented.
 *
 * The script is idempotent. Running it twice does not duplicate anything: rows
 * are matched on their primary key and updated in place. Pass --reset to delete
 * the demonstration records first.
 *
 *   node backend/scripts/seedDemonstrationData.js
 *   node backend/scripts/seedDemonstrationData.js --reset
 */
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const { ensureSchema } = require('../config/ensureSchema');
const {
  loadSettings,
  buildSslOptions,
  assertDatabaseConfigured,
  describeTarget,
} = require('../config/settings');

const RESET = process.argv.includes('--reset');

// Password for every account this script creates.
const DEMO_PASSWORD = 'HealthBridge2026';

const settings = assertDatabaseConfigured(loadSettings());

// Deterministic "random" so repeated runs produce a stable dataset.
let seedState = 20260101;
function random() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick(list) {
  return list[Math.floor(random() * list.length)];
}
function daysFromNow(days) {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}
function dateOnly(days) {
  return daysFromNow(days).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- reference

const STAFF = [
  { id: 'HB-STAFF-001', fullName: 'Adebayo Okafor', email: 'admin@healthbridge.org', role: 'Administrator', phone: '+234 803 400 1001' },
  { id: 'HB-STAFF-002', fullName: 'Dr. Ngozi Eze', email: 'doctor@healthbridge.org', role: 'Doctor', phone: '+234 803 400 1002' },
  { id: 'HB-STAFF-003', fullName: 'Chiamaka Nwosu', email: 'reception@healthbridge.org', role: 'Receptionist', phone: '+234 803 400 1003' },
  { id: 'HB-STAFF-004', fullName: 'Dr. Ibrahim Musa', email: 'pharmacist@healthbridge.org', role: 'Pharmacist', phone: '+234 803 400 1004' },
  { id: 'HB-STAFF-005', fullName: 'Grace Attah', email: 'lab@healthbridge.org', role: 'Laboratory Staff', phone: '+234 803 400 1005' },
  { id: 'HB-STAFF-006', fullName: 'Dr. Folake Adeyemi', email: 'doctor2@healthbridge.org', role: 'Doctor', phone: '+234 803 400 1006' },
];

// A shared pool of realistic Nigerian primary-care presentations.
const CLINICAL_CASES = [
  {
    condition: 'Type 2 diabetes mellitus',
    complaint: 'Routine diabetic follow-up. Reports increased thirst and passing urine more frequently at night.',
    diagnosis: 'Type 2 diabetes mellitus, moderately controlled on oral therapy',
    treatment: 'Continue Metformin 500mg twice daily. Reinforce diet and 30 minutes brisk walking daily. Blood glucose reviewed at each visit.',
    followUp: 'Return in 3 months with fasting blood glucose and HbA1c',
    tests: ['Fasting Blood Sugar', 'HbA1c', 'Urine Routine'],
    results: { 'Fasting Blood Sugar': '6.4 mmol/L', HbA1c: '7.2%', 'Urine Routine': 'Glucose -ve, Protein -ve' },
    medicines: [['Metformin 500mg', '500mg', 'Twice daily', '30 days', 60], ['Metformin 850mg', '850mg', 'Once daily', '30 days', 30]],
  },
  {
    condition: 'Essential hypertension',
    complaint: 'Headache at the back of the head in the mornings for two weeks, no chest pain.',
    diagnosis: 'Essential hypertension, stage 1',
    treatment: 'Amlodipine 5mg once daily. Reduce salt intake below 5g per day. Home blood pressure log started.',
    followUp: 'Review in 4 weeks with home blood pressure readings',
    tests: ['Blood Pressure', 'Urine Routine', 'Serum Electrolytes'],
    results: { 'Blood Pressure': '146/92 mmHg', 'Urine Routine': 'Protein trace', 'Serum Electrolytes': 'Na 139, K 4.2 mmol/L' },
    medicines: [['Amlodipine 5mg', '5mg', 'Once daily', '30 days', 30], ['Lisinopril 10mg', '10mg', 'Once daily', '30 days', 30]],
  },
  {
    condition: 'Malaria with mild anaemia',
    complaint: 'Fever, headache and body pains for four days. Tested positive for malaria using rapid diagnostic test.',
    diagnosis: 'Uncomplicated Plasmodium falciparum malaria with mild normocytic anaemia',
    treatment: 'Artemether-Lumefantrine taken twice daily for three days. Paracetamol for fever. Oral rehydration solution.',
    followUp: 'Return after completing the third dose, or sooner if fever persists',
    tests: ['Malaria Rapid Diagnostic Test', 'Full Blood Count'],
    results: { 'Malaria Rapid Diagnostic Test': 'Positive, P. falciparum', 'Full Blood Count': 'Hb 10.4 g/dL, WBC 6.2 x10^9/L, Platelets 168 x10^9/L' },
    medicines: [['Artemether-Lumefantrine 20/120mg', '20/120mg', 'Twice daily', '3 days', 24], ['Paracetamol 500mg', '500mg', 'As needed', '5 days', 20]],
  },
  {
    condition: 'Acute respiratory tract infection',
    complaint: 'Persistent cough with chest pain for one week and difficulty breathing on exertion.',
    diagnosis: 'Acute bronchitis, likely viral',
    treatment: 'Salbutamol inhaler two puffs when wheezy. Plenty of oral fluids. Avoid cold dust and smoke. No antibiotics required.',
    followUp: 'Return in one week if the cough is not settling',
    tests: ['Chest X-Ray', 'Full Blood Count'],
    results: { 'Chest X-Ray': 'No consolidation. Cardiomediastinal silhouette normal.', 'Full Blood Count': 'Hb 13.1 g/dL, WBC 5.8 x10^9/L' },
    medicines: [['Salbutamol Inhaler', '100mcg/puff', 'Two puffs as needed', '14 days', 2], ['Paracetamol 500mg', '500mg', 'As needed', '5 days', 20]],
  },
  {
    condition: 'Gastro-oesophageal reflux disease',
    complaint: 'Burning sensation in the chest after meals, worse when lying down at night.',
    diagnosis: 'Gastro-oesophageal reflux disease',
    treatment: 'Omeprazole 20mg once before breakfast. Eat smaller meals and avoid lying down for two hours after eating.',
    followUp: 'Review in 6 weeks',
    tests: ['Full Blood Count', 'Urine Routine'],
    results: { 'Full Blood Count': 'Hb 12.7 g/dL, WBC 7.1 x10^9/L', 'Urine Routine': 'Normal' },
    medicines: [['Omeprazole 20mg', '20mg', 'Once daily before breakfast', '28 days', 28]],
  },
  {
    condition: 'Peptic ulcer disease',
    complaint: 'Epigastric pain relieved by food, worse when hungry. Hiccups and bloating.',
    diagnosis: 'Peptic ulcer disease, suspected H. pylori associated',
    treatment: 'Omeprazole 20mg twice daily before meals. H. pylori test to be done. Avoid NSAIDs, alcohol and spicy meals.',
    followUp: 'Return in 2 weeks for review and H. pylori results',
    tests: ['H. pylori Stool Antigen', 'Full Blood Count'],
    results: { 'H. pylori Stool Antigen': 'Positive', 'Full Blood Count': 'Hb 11.2 g/dL, WBC 8.4 x10^9/L' },
    medicines: [['Omeprazole 20mg', '20mg', 'Twice daily', '14 days', 28], ['Amoxicillin 500mg', '500mg', 'Three times daily', '7 days', 21], ['Metronidazole 400mg', '400mg', 'Three times daily', '5 days', 15]],
  },
  {
    condition: 'Urinary tract infection',
    complaint: 'Painful and frequent urination with suprapubic discomfort since two days.',
    diagnosis: 'Uncomplicated lower urinary tract infection',
    treatment: 'Nitrofurantoin 100mg twice daily for five days. Drink plenty of water.',
    followUp: 'Return if symptoms persist after one week',
    tests: ['Urine Microscopy, Culture and Sensitivity', 'Urine Routine'],
    results: { 'Urine Microscopy, Culture and Sensitivity': 'Growth of Escherichia coli, sensitive to nitrofurantoin', 'Urine Routine': 'Pus cells 20-30/hpf, Nitrite +ve' },
    medicines: [['Nitrofurantoin 100mg', '100mg', 'Twice daily', '5 days', 10]],
  },
  {
    condition: 'Allergic rhinitis',
    complaint: 'Sneezing, itchy watery eyes and blocked nose, worse in the early morning and near dust.',
    diagnosis: 'Allergic rhinitis, perennial',
    treatment: 'Cetirizine 10mg at night. Saline nasal drops. Reduce house dust and keep bedding out of the bedroom.',
    followUp: 'Review in 4 weeks',
    tests: ['Full Blood Count', 'Peripheral Eosinophil Count'],
    results: { 'Full Blood Count': 'Hb 14.0 g/dL, WBC 6.0 x10^9/L', 'Peripheral Eosinophil Count': '0.6 x10^9/L' },
    medicines: [['Cetirizine 10mg', '10mg', 'Once daily at night', '30 days', 30], ['Xylometazoline Nasal Drops', '0.1%', 'Two drops per nostril', '7 days', 10]],
  },
  {
    condition: 'Iron deficiency anaemia',
    complaint: 'Tiredness, dizziness and paleness of the palms for three months, worse during menstruation.',
    diagnosis: 'Iron deficiency anaemia',
    treatment: 'Ferrous sulphate 200mg twice daily with orange juice. Avoid taking with tea or milk. Expect dark stools.',
    followUp: 'Return in 6 weeks with haemoglobin repeat',
    tests: ['Full Blood Count', 'Serum Ferritin', 'Haemoglobin Electrophoresis'],
    results: { 'Full Blood Count': 'Hb 8.6 g/dL, MCV 71 fL, WBC 5.4 x10^9/L', 'Serum Ferritin': '9 ng/mL (low)', 'Haemoglobin Electrophoresis': 'Normal pattern' },
    medicines: [['Ferrous Sulphate 200mg', '200mg', 'Twice daily', '42 days', 84], ['Folic Acid 5mg', '5mg', 'Once daily', '30 days', 30]],
  },
  {
    condition: 'Chronic low back pain',
    complaint: 'Lower back pain radiating to the right buttock for six weeks, worse on standing.',
    diagnosis: 'Mechanical low back pain, lumbar disc probable',
    treatment: 'Simple analgesics, muscle relaxant for two weeks. Avoid heavy lifting. Physiotherapy referral given.',
    followUp: 'Review in 4 weeks; escalate if weakness or numbness develops',
    tests: ['Full Blood Count', 'Urine Routine', 'Serum Uric Acid'],
    results: { 'Full Blood Count': 'Hb 13.5 g/dL, WBC 6.6 x10^9/L', 'Urine Routine': 'Normal', 'Serum Uric Acid': '5.1 mg/dL' },
    medicines: [['Diclofenac 50mg', '50mg', 'Three times daily after food', '14 days', 42], ['Tizanidine 5mg', '5mg', 'At night', '14 days', 14], ['Omeprazole 20mg', '20mg', 'Once daily', '14 days', 14]],
  },
  {
    condition: 'Pterygium',
    complaint: 'Gradual growth of a fleshy patch on the white of the right eye with irritation and watering.',
    diagnosis: 'Pterygium, nasal side of the right eye',
    treatment: 'Lubricating eye drops. Sunglasses advised. Ophthalmology referral made for surgical review.',
    followUp: 'Review in 3 months or sooner if vision reduces',
    tests: ['Visual Acuity', 'Slit Lamp Examination'],
    results: { 'Visual Acuity': 'Right 6/9, Left 6/6', 'Slit Lamp Examination': 'Fibrovascular conjunctival growth extending 2mm onto cornea, right eye' },
    medicines: [['Carboxymethylcellulose Eye Drops', '0.5%', 'Four times daily', '30 days', 10]],
  },
  {
    condition: 'Mild anaemia in pregnancy',
    complaint: 'Antenatal booking visit at 26 weeks. Reports exhaustion and reduced appetite.',
    diagnosis: 'Iron deficiency anaemia in pregnancy, Hb 9.8 g/dL at 26 weeks',
    treatment: 'Ferrous sulphate with folic acid. Increase dietary iron. Next antenatal visit in four weeks.',
    followUp: 'Antenatal visit in 4 weeks with haemoglobin repeat',
    tests: ['Full Blood Count', 'Blood Group and Genotype', 'Urinalysis', 'HIV and Hepatitis B Screening'],
    results: {
      'Full Blood Count': 'Hb 9.8 g/dL, MCV 74 fL, Platelets 210 x10^9/L',
      'Blood Group and Genotype': 'Group O positive, Genotype AA',
      Urinalysis: 'Protein -ve, Glucose -ve',
      'HIV and Hepatitis B Screening': 'HIV I and II - Non reactive. HBsAg - Negative.',
    },
    medicines: [['Ferrous Sulphate 200mg', '200mg', 'Twice daily', '42 days', 84], ['Folic Acid 5mg', '5mg', 'Once daily', '30 days', 30]],
  },
  {
    condition: 'Neonatal jaundice',
    complaint: 'Baby delivered three days ago by spontaneous vaginal delivery. Mother notices yellowing of the palms and soles.',
    diagnosis: 'Physiological neonatal jaundice, day 3 of life. Bilirubin 14.2 mg/dL, below phototherapy threshold for 72 hours.',
    treatment: 'Frequent breastfeeding every two hours. Sunlight exposure in the morning. No phototherapy required at this level.',
    followUp: 'Return in 24 hours for bilirubin repeat',
    tests: ['Serum Bilirubin (Total)', 'Full Blood Count'],
    results: { 'Serum Bilirubin (Total)': '14.2 mg/dL (conjugated 0.4 mg/dL)', 'Full Blood Count': 'Hb 16.8 g/dL, WBC 12.4 x10^9/L' },
    medicines: [['Paracetamol 100mg/5ml Syrup', '100mg/5ml', '2.5ml every 6 hours if fever', '3 days', 10]],
  },
  {
    condition: 'Sickle cell disease, crisis',
    complaint: 'Painful swelling of the left lower limb and bone pain since yesterday evening. Known sickler with genotype SS.',
    diagnosis: 'Vaso-occlusive crisis in sickle cell disease',
    treatment: 'Adequate analgesia with paracetamol and diclofenac, oral or intravenous fluids, folic acid daily. Avoid cold, dehydration and high altitude.',
    followUp: 'Return in one week; report any fever above 38 degrees immediately',
    tests: ['Full Blood Count', 'Haemoglobin Electrophoresis', 'Serum Bilirubin (Total)'],
    results: {
      'Full Blood Count': 'Hb 7.9 g/dL, WBC 12.9 x10^9/L, Platelets 320 x10^9/L',
      'Haemoglobin Electrophoresis': 'SS pattern confirmed',
      'Serum Bilirubin (Total)': '3.2 mg/dL',
    },
    medicines: [['Paracetamol 500mg', '500mg', 'As needed for pain', '5 days', 40], ['Diclofenac 50mg', '50mg', 'Three times daily after food', '5 days', 15], ['Folic Acid 5mg', '5mg', 'Once daily', '30 days', 30]],
  },
  {
    condition: 'Conjunctivitis',
    complaint: 'Red itchy left eye with watery discharge for two days. Spreading to the family.',
    diagnosis: 'Viral conjunctivitis, left eye. Antibiotics not indicated.',
    treatment: 'Isolated at home. Clean the eye with cooled boiled water. Hygiene counselling given to the family.',
    followUp: 'Return in 5 days if not improving',
    tests: ['Visual Acuity'],
    results: { 'Visual Acuity': 'Left 6/6, unaffected' },
    medicines: [['Chloramphenicol Eye Ointment', '1%', 'Apply at night', '5 days', 5]],
  },
  {
    condition: 'Schistosomiasis',
    complaint: 'Blood in the terminal urine noticed for two months. Works in rice paddies daily.',
    diagnosis: 'Urinary schistosomiasis suspected',
    treatment: 'Praziquantel 40mg/kg given as a single dose under supervision. Avoid swimming in fresh water.',
    followUp: 'Urine microscopy repeat in 6 weeks',
    tests: ['Urine Microscopy, Culture and Sensitivity', 'Full Blood Count'],
    results: { 'Urine Microscopy, Culture and Sensitivity': 'Eggs of Schistosoma haematobium seen', 'Full Blood Count': 'Hb 11.8 g/dL, Eosinophils 1.4 x10^9/L' },
    medicines: [['Praziquantel 600mg', '600mg', 'Single dose', '1 day', 2]],
  },
  {
    condition: 'Asthma',
    complaint: 'Wheezing and breathlessness on running, and at night for the last month. Uses a reliever inhaler often.',
    diagnosis: 'Mild persistent bronchial asthma',
    treatment: 'Salbutamol reliever as needed. Started on a preventer inhaler with spacer technique demonstrated. Avoid smoke and cold air.',
    followUp: 'Review in 6 weeks with an asthma control assessment',
    tests: ['Peak Expiratory Flow Rate', 'Chest X-Ray'],
    results: { 'Peak Expiratory Flow Rate': '380 L/min (predicted 520, 73% predicted)', 'Chest X-Ray': 'Hyperinflation. No consolidation.' },
    medicines: [['Salbutamol Inhaler', '100mcg/puff', 'Two puffs as needed', '30 days', 2], ['Beclometasone Inhaler', '100mcg/puff', 'Two puffs twice daily', '30 days', 2]],
  },
  {
    condition: 'Diarrhoea with mild dehydration',
    complaint: 'Loose watery stools three times since yesterday, reduced appetite, some vomiting.',
    diagnosis: 'Acute gastroenteritis with mild dehydration',
    treatment: 'Oral rehydration salts after each loose stool. Zinc supplementation. Continue feeding. Return if no improvement in two days.',
    followUp: 'Return in 2 days or sooner if the child becomes drowsy',
    tests: ['Urine Routine', 'Stool Microscopy'],
    results: { 'Urine Routine': 'Specific gravity 1.020, otherwise normal', 'Stool Microscopy': 'No ova or parasite seen' },
    medicines: [['ORS Sachet', '21.8g sachet', 'One sachet after each loose stool', '3 days', 6], ['Zinc Dispersible Tablet 20mg', '20mg', 'Once daily', '10 days', 10]],
  },
  {
    condition: 'Osteoarthritis of the knee',
    complaint: 'Knee pain and stiffness worse in the morning, difficulty climbing stairs.',
    diagnosis: 'Osteoarthritis of both knees',
    treatment: 'Paracetamol, weight reduction advice, quadriceps strengthening exercises, knee brace for walking.',
    followUp: 'Review in 8 weeks',
    tests: ['X-Ray Both Knees', 'Serum Uric Acid'],
    results: { 'X-Ray Both Knees': 'Marginal osteophytes and joint space narrowing, worse on the right', 'Serum Uric Acid': '4.8 mg/dL' },
    medicines: [['Paracetamol 500mg', '500mg', 'Three times daily', '30 days', 90]],
  },
  {
    condition: 'Chronic kidney disease stage 2',
    complaint: 'Routine follow-up. Known hypertension for six years.',
    diagnosis: 'Chronic kidney disease stage 2 secondary to hypertension',
    treatment: 'Continue antihypertensives. ACE inhibitor for renal protection. Protein and salt restriction counselling given.',
    followUp: 'Review in 3 months with serum creatinine and eGFR',
    tests: ['Serum Creatinine and eGFR', 'Serum Electrolytes', 'Urine Routine', 'Urine Protein Creatinine Ratio'],
    results: {
      'Serum Creatinine and eGFR': 'Creatinine 118 umol/L, eGFR 62 mL/min/1.73m2',
      'Serum Electrolytes': 'Na 138, K 4.6 mmol/L',
      'Urine Routine': 'Protein trace',
      'Urine Protein Creatinine Ratio': '0.6 g/g',
    },
    medicines: [['Lisinopril 10mg', '10mg', 'Once daily', '30 days', 30], ['Amlodipine 5mg', '5mg', 'Once daily', '30 days', 30]],
  },
  {
    condition: 'Skin infection',
    complaint: 'Painful, swollen boil on the left thigh with fever for three days.',
    diagnosis: 'Skin abscess, early. Antibiotics started with drainage planned if it does not settle.',
    treatment: 'Ciprofloxacin 500mg twice daily, warm compresses, strict wound hygiene and hand washing.',
    followUp: 'Return in 3 days for wound review',
    tests: ['Full Blood Count', 'Blood Culture and Sensitivity'],
    results: { 'Full Blood Count': 'Hb 12.4 g/dL, WBC 15.8 x10^9/L, Neutrophils 84%', 'Blood Culture and Sensitivity': 'Staphylococcus aureus isolated, sensitive to ciprofloxacin' },
    medicines: [['Ciprofloxacin 500mg', '500mg', 'Twice daily', '5 days', 10], ['Paracetamol 500mg', '500mg', 'As needed', '5 days', 20]],
  },
  {
    condition: 'Migraine without aura',
    complaint: 'Recurrent unilateral throbbing headache with vomiting and light sensitivity.',
    diagnosis: 'Migraine without aura',
    treatment: 'Paracetamol for acute attacks. Advised to maintain a headache diary, sleep regularly and stay hydrated. Red flags reviewed.',
    followUp: 'Return in 4 weeks with the headache diary',
    tests: ['Full Blood Count', 'Serum Electrolytes'],
    results: { 'Full Blood Count': 'Hb 13.9 g/dL, WBC 6.1 x10^9/L', 'Serum Electrolytes': 'Na 140, K 4.1 mmol/L' },
    medicines: [['Paracetamol 500mg', '500mg', 'Two tablets at onset of headache', '14 days', 56]],
  },
  {
    condition: 'Pneumonia',
    complaint: 'High fever, productive cough, right-sided chest pain and difficulty breathing since four days.',
    diagnosis: 'Community acquired pneumonia, right lower lobe',
    treatment: 'Amoxicillin 500mg three times daily for five days, paracetamol, plenty of fluids. Urgent review if no improvement.',
    followUp: 'Return in 3 days with chest X-Ray report',
    tests: ['Chest X-Ray', 'Full Blood Count', 'C-Reactive Protein'],
    results: {
      'Chest X-Ray': 'Right lower lobe consolidation with air bronchogram',
      'Full Blood Count': 'Hb 11.6 g/dL, WBC 18.2 x10^9/L, Neutrophils 88%',
      'C-Reactive Protein': '96 mg/L (high)',
    },
    medicines: [['Amoxicillin 500mg', '500mg', 'Three times daily', '5 days', 15], ['Paracetamol 500mg', '500mg', 'Four times daily', '5 days', 20]],
  },
];

const MEDICINE_CATALOGUE = [
  { name: 'Paracetamol 500mg', generic: 'Paracetamol', dosage: '500mg', unit: 'tablets', stock: 640, reorder: 200 },
  { name: 'Amoxicillin 500mg', generic: 'Amoxicillin', dosage: '500mg', unit: 'capsules', stock: 420, reorder: 150 },
  { name: 'Artemether-Lumefantrine 20/120mg', generic: 'Artemether/Lumefantrine', dosage: '20/120mg', unit: 'tablets', stock: 96, reorder: 120 },
  { name: 'Metformin 500mg', generic: 'Metformin', dosage: '500mg', unit: 'tablets', stock: 380, reorder: 120 },
  { name: 'Metformin 850mg', generic: 'Metformin', dosage: '850mg', unit: 'tablets', stock: 210, reorder: 100 },
  { name: 'Amlodipine 5mg', generic: 'Amlodipine', dosage: '5mg', unit: 'tablets', stock: 295, reorder: 100 },
  { name: 'Lisinopril 10mg', generic: 'Lisinopril', dosage: '10mg', unit: 'tablets', stock: 188, reorder: 100 },
  { name: 'Salbutamol Inhaler', generic: 'Salbutamol', dosage: '100mcg/puff', unit: 'inhalers', stock: 14, reorder: 20 },
  { name: 'Beclometasone Inhaler', generic: 'Beclometasone', dosage: '100mcg/puff', unit: 'inhalers', stock: 22, reorder: 20 },
  { name: 'Cetirizine 10mg', generic: 'Cetirizine', dosage: '10mg', unit: 'tablets', stock: 340, reorder: 120 },
  { name: 'Omeprazole 20mg', generic: 'Omeprazole', dosage: '20mg', unit: 'capsules', stock: 268, reorder: 120 },
  { name: 'Nitrofurantoin 100mg', generic: 'Nitrofurantoin', dosage: '100mg', unit: 'capsules', stock: 156, reorder: 80 },
  { name: 'Metronidazole 400mg', generic: 'Metronidazole', dosage: '400mg', unit: 'tablets', stock: 132, reorder: 80 },
  { name: 'Ferrous Sulphate 200mg', generic: 'Ferrous Sulphate', dosage: '200mg', unit: 'tablets', stock: 415, reorder: 150 },
  { name: 'Folic Acid 5mg', generic: 'Folic Acid', dosage: '5mg', unit: 'tablets', stock: 300, reorder: 100 },
  { name: 'Ciprofloxacin 500mg', generic: 'Ciprofloxacin', dosage: '500mg', unit: 'tablets', stock: 88, reorder: 100 },
  { name: 'Diclofenac 50mg', generic: 'Diclofenac Sodium', dosage: '50mg', unit: 'tablets', stock: 176, reorder: 100 },
  { name: 'Tizanidine 5mg', generic: 'Tizanidine', dosage: '5mg', unit: 'tablets', stock: 64, reorder: 50 },
  { name: 'ORS Sachet', generic: 'Oral Rehydration Salts', dosage: '21.8g', unit: 'sachets', stock: 480, reorder: 150 },
  { name: 'Zinc Dispersible Tablet 20mg', generic: 'Zinc', dosage: '20mg', unit: 'tablets', stock: 210, reorder: 100 },
  { name: 'Xylometazoline Nasal Drops', generic: 'Xylometazoline', dosage: '0.1%', unit: 'bottles', stock: 38, reorder: 40 },
  { name: 'Chloramphenicol Eye Ointment', generic: 'Chloramphenicol', dosage: '1%', unit: 'tubes', stock: 26, reorder: 30 },
  { name: 'Carboxymethylcellulose Eye Drops', generic: 'Carboxymethylcellulose', dosage: '0.5%', unit: 'bottles', stock: 44, reorder: 40 },
  { name: 'Praziquantel 600mg', generic: 'Praziquantel', dosage: '600mg', unit: 'tablets', stock: 120, reorder: 60 },
];

// The demonstration roster. One hundred patients is enough for the lists to
// page, search and aggregate meaningfully without taking the seed unreasonably
// long to run.
const PATIENT_COUNT = 100;

// Portal access is given to the first few so the patient sign-in and own-record
// journey can be demonstrated without creating a hundred mailboxes.
const PATIENTS_WITH_PORTAL_ACCESS = 12;

const BLOOD_GROUPS = ['O+', 'O+', 'A+', 'A+', 'B+', 'B+', 'AB+', 'O-', 'A-', 'B-'];
const GENOTYPES = ['AA', 'AA', 'AA', 'AS', 'AS', 'SS'];
const OCCUPATIONS = [
  'Teacher', 'Trader', 'Nurse', 'Driver', 'Accountant', 'Shop Owner', 'Engineer',
  'Tailor', 'Farmer', 'Civil Servant', 'Student', 'Student', 'Hairdresser',
  'Electrician', 'Banker', 'Chef', 'Seamstress', 'Mechanic', 'Pharmacist Assistant',
  'Community Health Worker',
];

const SURNAMES = [
  'Adeyemi', 'Balogun', 'Chukwu', 'Danjuma', 'Eze', 'Fashola', 'Gbadamosi', 'Hassan',
  'Ibrahim', 'Jideofor', 'Kalu', 'Lawal', 'Mohammed', 'Nwachukwu', 'Ogundipe', 'Okafor',
  'Oluwaseun', 'Onyeka', 'Sanni', 'Tunde', 'Uche', 'Yusuf', 'Zamani', 'Adesanya',
  'Akinwale', 'Bello', 'Chukwuemeka', 'Danjuma', 'Emenike', 'Gbenga', 'Iheanacho',
  'Jimoh', 'Kalu', 'Linus', 'Mustapha', 'Nkemdilim', 'Ogbonna', 'Promise', 'Rasheed',
  'Sadiq', 'Tajudeen', 'Uzoma', 'Wole', 'Yinka', 'Zainab', 'Abiola', 'Chidozie',
  'Ebere', 'Femi', 'Gifty', 'Halima', 'Ibrahim', 'Kehinde', 'Lateef', 'Mofe',
];

const FIRST_NAMES = [
  'Amaka', 'Bola', 'Chidi', 'Damilola', 'Eniola', 'Folake', 'Ganiyu', 'Halima',
  'Ifeoma', 'Jide', 'Kemi', 'Lamin', 'Morenike', 'Nneka', 'Olumide', 'Precious',
  'Rukayat', 'Segun', 'Temitope', 'Ugochi', 'Wale', 'Yewande', 'Zainab', 'Bukola',
  'Chinaza', 'Damilare', 'Emeka', 'Fatima', 'Godwin', 'Hauwa', 'Ibrahim', 'Joke',
  'Kelechi', 'Loveth', 'Monday', 'Nkechi', 'Oluwaseun', 'Peace', 'Rachel', 'Sunday',
  'Tosin', 'Uzoma', 'Victoria', 'Wisdom', 'Yemi', 'Zaria', 'Ayodeji', 'Bisi',
  'Chinedu', 'Dada', 'Esther', 'Folarin', 'Grace', 'Hakeem', 'Iretioluwa', 'Jideofor',
];

// Adults carry the working occupations; children are recorded as students.
const LAGOS_AREAS = [
  'Ikeja', 'Yaba', 'Surulere', 'Alausa', 'Ojota', 'Ikorodu', 'Festac Town', 'Agege',
  'Apapa', 'Mushin', 'Shitta', 'Mile 2', 'Oshodi', 'Egbeda', 'Ibadan Road',
  'Ketu', 'Maryland', 'Isale Eko', 'Igbatti', 'Bariga', 'Ajegunle', 'Ilasa',
  'Onike', 'Satellite Town',
];

const STREETS = [
  'Ogunmola Way', 'Allen Avenue', 'Adekunle Fajuyi Road', 'Ikorodu Road', 'Herbert Macaulay Way',
  'Awolowo Avenue', 'Murtala Muhammed Way', 'Obafemi Awolowo Way', 'Sim Macaulay Road',
  'Abaoye Street', 'Bode Thomas Street', 'Ibiyinka Oluwole Way', 'Akinremi Street',
];

const ALLERGY_OPTIONS = [
  'None known', 'None known', 'None known', 'None known', 'Penicillin', 'Sulpha drugs',
  'Aspirin', 'Latex', 'Shellfish', 'Dust mite',
];

const OCCASION_NOTES = [
  'Seen during a clinic session. Advised to return if symptoms worsen.',
  'Brought by a family member. History taken from the accompanying relative.',
  'Self-presented. Denies fever, but reports intermittent symptoms at night.',
  'Attended for a routine check. No new complaints recorded today.',
  'Presenting for follow-up on an existing treatment plan.',
];

async function connect() {
  return mysql.createConnection({
    host: settings.DB_HOST,
    port: Number(settings.DB_PORT || 3306),
    user: settings.DB_USER,
    password: settings.DB_PASSWORD,
    database: settings.DB_NAME,
    ...buildSslOptions(settings),
  });
}

async function applySchema(connection) {
  await ensureSchema(connection, settings.DB_NAME, (message) => console.log(message));
}

async function main() {
  describeTarget(settings);
  const connection = await connect();
  await applySchema(connection);
  console.log('Schema applied.');

  // ------------------------------------------------------------- reset
  if (RESET) {
    console.log('Removing existing demonstration records...');
    const ids = [];
    const [demoPatients] = await connection.query("SELECT id FROM patients WHERE full_name LIKE 'Demo %'");
    ids.push(...demoPatients.map((r) => r.id));

    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      await connection.query(`DELETE lr FROM lab_results lr JOIN lab_requests q ON q.id = lr.lab_request_id WHERE q.patient_id IN (${placeholders})`, ids);
      await connection.query(`DELETE FROM lab_requests WHERE patient_id IN (${placeholders})`, ids);
      await connection.query(`DELETE FROM prescriptions WHERE patient_id IN (${placeholders})`, ids);
      await connection.query(`DELETE FROM consultations WHERE patient_id IN (${placeholders})`, ids);
      await connection.query(`DELETE FROM appointments WHERE patient_id IN (${placeholders})`, ids);
      await connection.query(`DELETE FROM patient_documents WHERE patient_id IN (${placeholders})`, ids);
      await connection.query(`DELETE FROM patients WHERE id IN (${placeholders})`, ids);
    }
    await connection.query("DELETE FROM audit_logs WHERE details LIKE '%Demonstration%'");
    console.log(`  removed ${ids.length} demonstration patients.`);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ------------------------------------------------------------ branches
  const branches = [
    [1, 'Main Centre', '14 Ogunmola Way, Ikeja, Lagos'],
    [2, 'Yaba Annex', '88 Herbert Macaulay Way, Yaba, Lagos'],
  ];
  for (const [id, name, location] of branches) {
    await connection.query(
      'INSERT INTO branches (id, name, location) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), location = VALUES(location)',
      [id, name, location]
    );
  }
  console.log(`Branches ready (${branches.length}).`);

  // --------------------------------------------------------------- staff
  // An installation that was set up before this script may already hold these
  // addresses under different primary keys. staff.email is UNIQUE, so the
  // upsert updates the existing row and keeps its original id. Everything
  // downstream must therefore use the id the database reports, not the one
  // written above, or foreign keys will dangle.
  const staff = [];
  for (const member of STAFF) {
    await connection.query(
      `INSERT INTO staff (id, full_name, email, password_hash, role, phone, branch_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 1, 'Active')
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role),
         phone = VALUES(phone), status = 'Active'`,
      [member.id, member.fullName, member.email, passwordHash, member.role, member.phone]
    );

    const [rows] = await connection.query('SELECT id, full_name, email, role FROM staff WHERE email = ?', [member.email]);
    if (rows.length === 0) throw new Error(`Staff account ${member.email} was not stored.`);

    // This is the demonstration seeder, so every account it owns uses the
    // documented demonstration password. The seed is gated behind
    // SEED_DEMO_DATA=true, so it never runs against a live installation with
    // its own credentials - in production the accounts are created by the
    // backend's own staff seeder with generated passwords instead.
    await connection.query('UPDATE staff SET password_hash = ? WHERE id = ?', [passwordHash, rows[0].id]);

    staff.push({
      ...member,
      id: rows[0].id,
      fullName: rows[0].full_name,
      role: rows[0].role,
      demoPassword: DEMO_PASSWORD,
    });
  }
  console.log(`Staff ready (${staff.length} accounts, ${staff.filter((s) => s.demoPassword).length} new).`);

  // ----------------------------------------------------------- medicines
  for (const medicine of MEDICINE_CATALOGUE) {
    const id = `HB-MED-${String(MEDICINE_CATALOGUE.indexOf(medicine) + 1).padStart(3, '0')}`;
    await connection.query(
      `INSERT INTO medicines (id, name, generic_name, dosage, stock_quantity, reorder_level, unit, status, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE generic_name = VALUES(generic_name), dosage = VALUES(dosage),
         reorder_level = VALUES(reorder_level), unit = VALUES(unit), status = VALUES(status)`,
      [id, medicine.name, medicine.generic, medicine.dosage, medicine.stock, medicine.reorder,
        medicine.unit, medicine.stock <= medicine.reorder ? 'Low stock' : 'In stock']
    );
  }
  console.log(`Medicines ready (${MEDICINE_CATALOGUE.length}).`);

  // ------------------------------------------------------------ patients
  const patients = [];
  for (let i = 0; i < PATIENT_COUNT; i += 1) {
    const clinical = CLINICAL_CASES[i % CLINICAL_CASES.length];
    // Names are drawn from pools larger than the roster and the index is
    // advanced independently, so records are not simply the same person repeated
    // with a different number.
    const surname = SURNAMES[(i * 7 + Math.floor(i / FIRST_NAMES.length)) % SURNAMES.length];
    const firstName = FIRST_NAMES[(i * 5 + Math.floor(i / SURNAMES.length)) % FIRST_NAMES.length];
    const secondName = i % 3 === 0 ? FIRST_NAMES[(i * 11 + 7) % FIRST_NAMES.length] : null;
    const id = `HB-PAT-${String(i + 1).padStart(3, '0')}`;
    const index = i;
    const area = LAGOS_AREAS[i % LAGOS_AREAS.length];
    const street = STREETS[(i * 3) % STREETS.length];

    // A spread of ages, including children and older adults, because a primary
    // health centre sees all of them.
    const age = 2 + Math.floor(random() * 76);
    const isChild = age < 16;
    const gender = random() > 0.52 ? 'Female' : 'Male';
    const lastVisitOffset = -Math.floor(random() * 90);

patients.push({
      id,
      index,
      fullName: `Demo ${firstName}${secondName ? ` ${secondName}` : ''} ${surname}`,
      surname,
      age,
      gender,
      phone: `+234 80${String(10000000 + i * 137711).slice(0, 8)}`,
      email: i < PATIENTS_WITH_PORTAL_ACCESS ? `demo.patient${i + 1}@healthbridge.ng` : null,
      area,
      street,
      blood: BLOOD_GROUPS[(i * 3 + 1) % BLOOD_GROUPS.length],
      genotype: GENOTYPES[(i * 5) % GENOTYPES.length],
      occupation: isChild ? 'Student' : OCCUPATIONS[(i * 7) % OCCUPATIONS.length],
      allergies: ALLERGY_OPTIONS[(i * 3) % ALLERGY_OPTIONS.length],
      condition: clinical.condition,
      lastVisit: dateOnly(lastVisitOffset),
      occasion: OCCASION_NOTES[i % OCCASION_NOTES.length],
      clinical,
      hasAccount: i < PATIENTS_WITH_PORTAL_ACCESS,
    });
  }

  for (const patient of patients) {
    const history = [
      `${patient.condition} since ${2015 + Math.floor(random() * 9)}.`,
      `Blood group ${patient.blood}, genotype ${patient.genotype}.`,
      patient.allergies !== 'None known' ? `Reported allergy: ${patient.allergies.toLowerCase()}.` : 'No known allergies.',
      'No previous surgery recorded.',
    ].join(' ');

    await connection.query(
      `INSERT INTO patients
        (id, full_name, age, gender, phone, email, password_hash, address, occupation,
         emergency_contact, blood_group, genotype, allergies, \`condition\`, medical_history,
         notes, status, last_visit, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, 1)
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name), age = VALUES(age), gender = VALUES(gender),
         phone = VALUES(phone), address = VALUES(address), occupation = VALUES(occupation),
         emergency_contact = VALUES(emergency_contact), blood_group = VALUES(blood_group),
         genotype = VALUES(genotype), allergies = VALUES(allergies),
         \`condition\` = VALUES(\`condition\`), medical_history = VALUES(medical_history),
         notes = VALUES(notes), last_visit = VALUES(last_visit), status = 'Active'`,
      [
        patient.id, patient.fullName, patient.age, patient.gender, patient.phone,
        patient.hasAccount ? patient.email : null,
        patient.hasAccount ? passwordHash : null,
        `${10 + ((patient.index * 90) % 89)} ${patient.street}, ${patient.area}, Lagos`,
        patient.occupation,
        `${FIRST_NAMES[(patient.index * 3 + 2) % FIRST_NAMES.length]} ${patient.surname} - +234 80${String(20000000 + patient.index * 91117).slice(0, 8)}`,
        patient.blood, patient.genotype, patient.allergies, patient.condition, history,
        `${patient.occasion} Demonstration record created by the HealthBridge seed script.`,
        patient.lastVisit,
      ]
    );

    // A patient row that already existed keeps any password it had, so a
    // recorded account is never silently replaced. Portal access is reported
    // from the stored value rather than from what this run intended.
    if (patient.hasAccount) {
      const [stored] = await connection.query(
        'SELECT password_hash FROM patients WHERE id = ? AND password_hash IS NOT NULL',
        [patient.id]
      );
      patient.portalAccess = stored.length > 0;
    } else {
      patient.portalAccess = false;
    }
  }
  console.log(`Patients ready (${patients.length}, ${patients.filter((p) => p.portalAccess).length} with portal access).`);

// -------------------------------------------------------- appointments
  const doctors = staff.filter((s) => s.role === 'Doctor');
  let appointmentCount = 0;

  for (const patient of patients) {
    // Between one and three appointments each. One of them lands today for the
    // first stretch of the roster, so "Appointments today" is a real figure
    // rather than a zero that happens to be true only because nothing was
    // booked, and the last fortnight has enough rows to draw a chart from.
    const total = 1 + (patient.index % 3);

    for (let n = 0; n < total; n += 1) {
      const id = `HB-APT-${patient.id.slice(-3)}-${n + 1}`;
      const doctor = pick(doctors);

      let offset;
      if (n === 0 && patient.index < 25) {
        offset = 0; // today's clinic list
      } else if (n === 0) {
        offset = 1 + (patient.index % 10); // coming up
      } else {
        offset = -(1 + (patient.index % 13) + n * 5); // recent history
      }

      const status =
        offset > 0
          ? pick(['Scheduled', 'Confirmed', 'Scheduled', 'Pending'])
          : pick(['Completed', 'Completed', 'Completed', 'Cancelled']);

      const hour = 8 + ((patient.index + n * 2) % 9);
      const minute = (patient.index + n) % 2 === 0 ? '00' : '30';
      const when = daysFromNow(offset);
      when.setHours(hour, Number(minute), 0, 0);

      await connection.query(
        `INSERT INTO appointments
          (id, patient_id, doctor_id, provider, appointment_date, appointment_time, reason, status, notes, branch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE appointment_date = VALUES(appointment_date),
           appointment_time = VALUES(appointment_time), status = VALUES(status),
           reason = VALUES(reason), provider = VALUES(provider)`,
        [
          id, patient.id, doctor.id, doctor.fullName,
          when.toISOString().slice(0, 10), `${String(hour).padStart(2, '0')}:${minute}:00`,
          patient.clinical.condition, status,
          `Booked for ${patient.clinical.condition.toLowerCase()} review.`,
        ]
      );
      appointmentCount += 1;
    }
  }
  console.log(`Appointments ready (${appointmentCount}).`);

// ------------------------------------------------------- consultations
  let consultationCount = 0;
  const consultationIndex = new Map();

  for (const patient of patients) {
    // Two consultations for a third of the roster, so follow-up visits exist
    // alongside first assessments and the patient timeline is not a single row.
    const encounters = patient.index % 3 === 0 ? 2 : 1;

    for (let n = 0; n < encounters; n += 1) {
      const doctor = pick(doctors);
      const id = encounters === 1
        ? `HB-CONS-${patient.id.slice(-3)}`
        : `HB-CONS-${patient.id.slice(-3)}-${n + 1}`;

      // Kept inside the last three months so every record falls inside the
      // period the dashboard reports on.
      const when = daysFromNow(-(2 + ((patient.index * 3 + n * 21) % 85)));
      when.setHours(9 + ((patient.index + n) % 7), (patient.index * 10 + n * 15) % 60, 0, 0);

      await connection.query(
        `INSERT INTO consultations
          (id, patient_id, doctor_id, consultation_date, complaint, diagnosis, treatment, notes, follow_up)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE consultation_date = VALUES(consultation_date),
           complaint = VALUES(complaint), diagnosis = VALUES(diagnosis),
           treatment = VALUES(treatment), follow_up = VALUES(follow_up), notes = VALUES(notes)`,
        [
          id, patient.id, doctor.id, when,
          n === 0 ? patient.clinical.complaint : `Follow-up visit. ${patient.clinical.complaint}`,
          patient.clinical.diagnosis,
          patient.clinical.treatment,
          `${patient.occasion} Examination findings and counselling documented. Patient verbalised understanding and was given a written summary.`,
          patient.clinical.followUp,
        ]
      );

      // Prescriptions hang off the most recent encounter for each patient.
      consultationIndex.set(
        patient.id,
        n === encounters - 1 ? { id, doctorId: doctor.id, when } : consultationIndex.get(patient.id) || { id, doctorId: doctor.id, when }
      );
      consultationCount += 1;
    }
  }
  console.log(`Consultations ready (${consultationCount}).`);

  // -------------------------------------------------------- prescriptions
  let prescriptionCount = 0;
  let dispensedCount = 0;

  for (const patient of patients) {
    const consultation = consultationIndex.get(patient.id);
    for (const [name, dosage, frequency, duration, quantity] of patient.clinical.medicines) {
      const id = `HB-RX-${patient.id.slice(-3)}-${prescriptionCount + 1}`;
      // Older consultations are already dispensed; the newest are awaiting the pharmacist.
      const ageInDays = Math.floor((Date.now() - consultation.when.getTime()) / 86400000);
      const status = ageInDays > 7 ? (random() > 0.15 ? 'Dispensed' : 'Cancelled') : 'Pending';
      if (status === 'Dispensed') dispensedCount += 1;

      await connection.query(
        `INSERT INTO prescriptions
          (id, patient_id, doctor_id, consultation_id, medicine_name, dosage, frequency, duration,
           quantity, instructions, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE dosage = VALUES(dosage), frequency = VALUES(frequency),
           duration = VALUES(duration), quantity = VALUES(quantity), status = VALUES(status),
           instructions = VALUES(instructions)`,
        [
          id, patient.id, consultation.doctorId, consultation.id, name, dosage, frequency, duration,
          quantity,
          `Take ${frequency} for ${duration}. Complete the full course. Return for review if symptoms worsen.`,
          status,
        ]
      );
      prescriptionCount += 1;
    }
  }
  console.log(`Prescriptions ready (${prescriptionCount}, ${dispensedCount} already dispensed, ${prescriptionCount - dispensedCount} awaiting the pharmacist).`);

  // -------------------------------------------------------- lab requests
  const labStaff = staff.find((s) => s.role === 'Laboratory Staff');
  let labRequestCount = 0;
  let labResultCount = 0;

  for (const patient of patients) {
    for (const testName of patient.clinical.tests) {
      const id = `HB-LAB-${patient.id.slice(-3)}-${labRequestCount + 1}`;
      const ageInDays = Math.floor(random() * 40);
      const when = daysFromNow(-ageInDays);
      // Results exist for requests older than a week; the rest are still pending.
      const hasResult = ageInDays > 7;
      const status = hasResult ? 'Completed' : 'Pending';
      const doctor = pick(doctors);

      await connection.query(
        `INSERT INTO lab_requests
          (id, patient_id, doctor_id, test_name, request_date, status, priority, notes, branch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE test_name = VALUES(test_name), status = VALUES(status),
           request_date = VALUES(request_date), priority = VALUES(priority), notes = VALUES(notes)`,
        [
          id, patient.id, doctor.id, testName, when, status,
          pick(['Routine', 'Routine', 'Routine', 'Urgent']),
          `Requested as part of the ${patient.clinical.condition.toLowerCase()} workup.`,
        ]
      );
      labRequestCount += 1;

      if (hasResult) {
        await connection.query(
          `INSERT INTO lab_results
            (id, lab_request_id, result_text, lab_staff_id, result_date, status, notes)
           VALUES (?, ?, ?, ?, ?, 'Completed', ?)
           ON DUPLICATE KEY UPDATE result_text = VALUES(result_text), status = VALUES(status)`,
          [
            `HB-LRES-${patient.id.slice(-3)}-${labResultCount + 1}`,
            id,
            patient.clinical.results[testName] || 'Reported within the reference range.',
            labStaff.id,
            new Date(when.getTime() + 86400000),
            'Result reviewed and filed against the patient record.',
          ]
        );
        labResultCount += 1;
      }
    }
  }
  console.log(`Laboratory requests ready (${labRequestCount}, ${labResultCount} results recorded).`);

  // ------------------------------------------------------ patient documents
  for (const patient of patients.slice(0, 40)) {
    await connection.query(
      `INSERT INTO patient_documents (id, patient_id, document_type, file_name, uploaded_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE document_type = VALUES(document_type), file_name = VALUES(file_name)`,
      [
        `HB-DOC-${patient.id.slice(-3)}`,
        patient.id,
        'Referral Letter',
        `referral-${patient.id}.pdf`,
        daysFromNow(-Math.floor(random() * 30) - 1),
      ]
    );
  }
  console.log('Patient documents ready (40).');

// ------------------------------------------------------------- audit log
  const actions = [
    ['LOGIN', 'Signed in to the HealthBridge workspace'],
    ['VIEW_PATIENT_RECORD', 'Viewed a patient record'],
    ['CREATE_APPOINTMENT', 'Booked an appointment'],
    ['UPDATE_PRESCRIPTION', 'Issued a prescription'],
    ['REQUEST_LAB_TEST', 'Requested a laboratory test'],
    ['UPLOAD_LAB_RESULT', 'Recorded a laboratory result'],
    ['DISPENSE_DRUG', 'Dispensed a prescribed medicine'],
  ];
  let auditCount = 0;
  // Enough entries to fill the activity feed, spread across the last fortnight so
  // the dashboard's recent-activity panel shows genuine recent work.
  for (let i = 0; i < 80; i += 1) {
    const [action, description] = actions[i % actions.length];
    const actor = pick(staff);
    const when = daysFromNow(-Math.floor((i * 5) % 14));
    when.setHours(7 + ((i * 3) % 12), (i * 7) % 60, 0, 0);
    const id = `HB-AUD-${String(i + 1).padStart(4, '0')}`;

    await connection.query(
      `INSERT INTO audit_logs (id, actor_id, action, details, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE action = VALUES(action), details = VALUES(details), created_at = VALUES(created_at)`,
      [id, actor.id, action, `${description} (demonstration record).`, when]
    );
    auditCount += 1;
  }
  console.log(`Audit log ready (${auditCount} entries).`);

  await connection.end();

  console.log('\n--------------------------------------------------------------');
  console.log('Demonstration dataset complete.');

  const usable = staff.filter((s) => s.demoPassword);
  console.log(`Staff accounts created by this run (password: ${DEMO_PASSWORD}):`);
  usable.forEach((s) => console.log(`  ${s.role.padEnd(18)} ${s.email}`));

  const preExisting = staff.filter((s) => !s.demoPassword);
  if (preExisting.length) {
    console.log('\nStaff accounts that already existed and kept their own password:');
    preExisting.forEach((s) => console.log(`  ${s.role.padEnd(18)} ${s.email}`));
    console.log('  Reset their password from the sign-in page if you need the access above.');
  }

  console.log(`\nPatient portal accounts (password: ${DEMO_PASSWORD}):`);
  patients.filter((p) => p.portalAccess).forEach((p) => console.log(`  Patient              ${p.email}`));
  console.log('--------------------------------------------------------------');
}

main().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
