-- cmd to seed data: psql -d <dbName> -U <dbOwnerName> -f seed.sql
-- doctor users --
INSERT INTO users (name, email, password, is_doctor, doctor_registration_number, photo, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, bank_number, consultation_price_cents) VALUES ('Albert Goh', 'doctor1@gmail.com', 'doctor1', TRUE, '1000001', 'doctor1.png', 'panadol', '1234567891011', '01/23', '101', '10000000001', 1500);
INSERT INTO users (name, email, password, is_doctor, doctor_registration_number, photo, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, bank_number, consultation_price_cents) VALUES ('Becka Lim', 'doctor2@gmail.com', 'doctor2', TRUE, '1000002', 'doctor2.jpg', 'fur', '1234567891012', '02/23', '102', '10000000002', 2000);
INSERT INTO users (name, email, password, is_doctor, doctor_registration_number, photo, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, bank_number, consultation_price_cents) VALUES ('Clara Neo', 'doctor3@gmail.com', 'doctor3', TRUE, '1000003', 'doctor3.jpg', 'nuts', '1234567891013', '03/23', '103', '10000000003', 15000);
INSERT INTO users (name, email, password, is_doctor, doctor_registration_number, photo, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, bank_number, consultation_price_cents) VALUES ('Dwyane Johnson', 'doctor4@gmail.com', 'doctor4', TRUE, '1000004', 'doctor4.jpg', 'beans', '1234567891014', '04/23', '104', '10000000004', 2000);
INSERT INTO users (name, email, password, is_doctor, doctor_registration_number, photo, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, bank_number, consultation_price_cents) VALUES ('Evril Ng', 'doctor5@gmail.com', 'doctor5', TRUE, '1000005', 'doctor5.jpg', 'dogs', '1234567891015', '05/23', '105', '10000000005', 2000);
INSERT INTO users (name, email, password, is_doctor, doctor_registration_number, photo, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, bank_number, consultation_price_cents) VALUES ('Francis Bo', 'doctor6@gmail.com', 'doctor6', TRUE, '1000006', 'doctor6.jpg', 'beans', '1234567891016', '06/23', '106', '10000000006', 2500);
INSERT INTO users (name, email, password, is_doctor, doctor_registration_number, photo, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, bank_number, consultation_price_cents) VALUES ('Gina Teo', 'doctor7@gmail.com', 'doctor7', TRUE, '1000007', 'doctor7.jpg', 'nil', '1234567891017', '07/23', '107', '10000000007', 2000);

-- patient users --
INSERT INTO users (name, email, password, is_doctor, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, photo) VALUES ('Henry Park', 'patient1@gmail.com', 'patient1', FALSE, 'nuts', '1234567891011', '01/24', '201', 'patient1.jpg');
INSERT INTO users (name, email, password, is_doctor, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, photo) VALUES ('Isabella Lin', 'patient2@gmail.com', 'patient2', FALSE, 'cats', '1234567891012', '02/24', '202', 'patient2.jpg');
INSERT INTO users (name, email, password, is_doctor, allergies, credit_card_number, credit_card_expiry, credit_card_cvv) VALUES ('Jackie Chan', 'patient3@gmail.com', 'patient3', FALSE, 'beans', '1234567891013', '03/24', '203');

-- clinics --
INSERT INTO clinics (name, photo, address) VALUES ('Pinnacle Family Clinic', 'pinnacle', 'blk 765 sengkang east road');
INSERT INTO clinics (name, photo, address) VALUES ('Mutal Healthcare', 'mutual', 'blk 500 shenton road');
INSERT INTO clinics (name, photo, address) VALUES ('Faith Healthcare', 'faith', 'blk 400 tampines east street');
INSERT INTO clinics (name, photo, address) VALUES ('My Family Clinic', 'my-family', 'blk 600 hougang way');

-- clinic_doctors --
INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (1, 1);
INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (1, 2);
INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (2, 2);
INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (2, 3);
INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (3, 4);
INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (3, 5);
INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (3, 6);
INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (4, 7);

-- medications
INSERT INTO medications (name, price_cents) VALUES ('ibuprofen', '500');
INSERT INTO medications (name, price_cents) VALUES ('namenda solution', '1000');
INSERT INTO medications (name, price_cents) VALUES ('guaifenasin solution', '2000');
INSERT INTO medications (name, price_cents) VALUES ('steroid cream', '2000');
INSERT INTO medications (name, price_cents) VALUES ('amoxicillin', '3000');







