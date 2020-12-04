INSERT INTO clinics (name, photo, address) VALUES ('sengkang clinic A', 'abcdefg', 'blk 765 sengkang east road');
INSERT INTO clinics (name, photo, address) VALUES ('sengkang clinic B', 'hijklmn', 'blk 760 sengkang west road');

INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (1, 1);
INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES (1, 2);

INSERT INTO users (name, email, password, is_doctor, doctor_registration_number, photo, allergies, credit_card_number, credit_card_expiry, credit_card_ccv, bank_number) VALUES ('Person A', 'user1@gmail.com', 'user1', TRUE, 100, 'asdasd', 'panadol', 1234, '02/22', 100, 123);
INSERT INTO users (name, email, password, is_doctor, doctor_registration_number, photo, allergies, credit_card_number, credit_card_expiry, credit_card_ccv, bank_number) VALUES ('Person B', 'user2@gmail.com', 'user2', TRUE, 200, 'asdasd', 'nuts', 5678, '01/22', 200, 456);
INSERT INTO users (name, email, password, is_doctor, allergies, credit_card_number, credit_card_expiry, credit_card_ccv) VALUES ('Person C', 'user3@gmail.com', 'user3', FALSE, 'sun', 8765, '01/22', 200);

INSERT INTO messages (sender_id, consultation_id, description) VALUES (1, 1, 'Hi what can I do for you today?');
INSERT INTO messages (sender_id, consultation_id, description) VALUES (3, 1, 'My head is throbbing.');





