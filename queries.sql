SELECT * FROM messages;
SELECT * FROM consultations;
SELECT * FROM prescriptions;
SELECT * FROM clinics;
SELECT * FROM users;
SELECT * FROM clinic_doctors;
SELECT * FROM medications;

UPDATE consultations SET diagnosis='mild headache' WHERE id=1;
UPDATE consultations SET consultation_price_cents=1050 WHERE id=1;
UPDATE consultations SET total_price_cents=2050 WHERE id=1;
UPDATE consultations SET status='ongoing' WHERE id=1;
UPDATE consultations SET status='requested' WHERE id=1;
UPDATE consultations SET status='requested' WHERE id=2;

UPDATE messages SET description='My head is throbbing' WHERE id=2;

ALTER TABLE consultations ADD COLUMN medicines_price_cents INT;
ALTER TABLE users ADD COLUMN consultation_price_cents INT;

UPDATE users SET consultation_price_cents=1050 WHERE id=1;

UPDATE consultations SET consultation_price_cents=1050 WHERE id=1;
UPDATE consultations SET total_price_cents=1050 WHERE id=1;
UPDATE consultations SET medicines_price_cents=0 WHERE id=5;

UPDATE consultations SET status='ongoing' WHERE id=1;

DELETE FROM prescriptions WHERE id=1;
