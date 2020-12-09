INSERT INTO clinics (name, photo, address) VALUES ('sengkang clinic A', 'abcdefg', 'blk 765 sengkang east road');
INSERT INTO clinics (name, photo, address) VALUES ('sengkang clinic B', 'hijklmn', 'blk 760 sengkang west road');

INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (1, 1);
INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (1, 2);

INSERT INTO users (name, email, password, is_doctor, doctor_registration_number, photo, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, bank_number, consultation_price_cents) VALUES ('Person A', 'user1@gmail.com', 'user1', TRUE, '100123213121', null, 'panadol', '12030291302930', '02/22', 100, '1233456789', 1050);
INSERT INTO users (name, email, password, is_doctor, doctor_registration_number, photo, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, bank_number, consultation_price_cents) VALUES ('Person B', 'user2@gmail.com', 'user2', TRUE, '100123213122', null, 'nuts', '12030291302931', '01/22', 200, '12030291302932', 1000);
INSERT INTO users (name, email, password, is_doctor, allergies, credit_card_number, credit_card_expiry, credit_card_cvv) VALUES ('Person C', 'user3@gmail.com', 'user3', FALSE, 'sun', '12030291302932', '01/22', 111);
INSERT INTO users (name, email, password, is_doctor, allergies, credit_card_number, credit_card_expiry, credit_card_cvv) VALUES ('Person D', 'user4@gmail.com', 'user4', FALSE, 'cats', '12030291302933', '01/22', 112);


INSERT INTO medications (name, price_cents) VALUES ('ibuprofen', '500');
INSERT INTO medications (name, price_cents) VALUES ('namenda solution', '1000');
INSERT INTO medications (name, price_cents) VALUES ('guaifenasin solution', '1500');
INSERT INTO medications (name, price_cents) VALUES ('steroid cream', '2000');







