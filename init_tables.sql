CREATE TABLE IF NOT EXISTS "messages" (
  "id" SERIAL,
  "sender_id" INT NOT NULL,
  "consultation_id" INT NOT NULL,
  "description" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "consultations" (
  "id" SERIAL,
  "patient_id" INT NOT NULL,
  "doctor_id" INT NOT NULL,
  "date" TIMESTAMPTZ NOT NULL,
  "status" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "diagnosis" TEXT,
  "consultation_price_cents" INT,
  "total_price_cents" INT,
  "medicines_price_cents" INT,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "prescriptions" (
  "id" SERIAL,
  "consultation_id" INT NOT NULL,
  "medicine_id" INT NOT NULL,
  "quantity" INT NOT NULL,
  "dosage_quantity" INT NOT NULL,
  "dosage_unit" TEXT NOT NULL,
  "frequency" TEXT NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "clinics" (
  "id" SERIAL,
  "name" TEXT NOT NULL,
  "photo" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL,
  "name" TEXT NOT NULL,
  "email" TEXT UNIQUE NOT NULL,
  "password" TEXT NOT NULL,
  "is_doctor" BOOLEAN NOT NULL,
  "doctor_registration_number" INT,
  "photo" TEXT,
  "allergies" TEXT NOT NULL,
  "credit_card_number" INT NOT NULL,
  "credit_card_expiry" TEXT NOT NULL,
  "credit_card_ccv" INT NOT NULL,
  "bank_number" INT,
  "consultation_price_cents" INT,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "clinic_doctors" (
  "id" SERIAL,
  "clinic_id" INT NOT NULL,
  "doctor_id" INT NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "medications" (
  "id" SERIAL,
  "name" TEXT NOT NULL,
  "price_cents" INT NOT NULL,
  PRIMARY KEY ("id")
);


