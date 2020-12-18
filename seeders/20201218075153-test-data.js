module.exports = {
  up: async (queryInterface) => {
    const doctorsInfo = [
      {
        name: 'Albert Goh',
        email: 'doctor1@gmail.com',
        password: 'doctor1',
        isDoctor: true,
        doctorRegistrationNumber: '1000001',
        photo: 'doctor1.png',
        allergies: 'panadol',
        creditCardNumber: '1234567891011',
        creditCardExpiry: '01/23',
        creditCardCvv: '101',
        bankNumber: '1000001',
        consultationPriceCents: 1500,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Becka Lim',
        email: 'doctor2@gmail.com',
        password: 'doctor2',
        isDoctor: true,
        doctorRegistrationNumber: '1000002',
        photo: 'doctor2.jpg',
        allergies: 'fur',
        creditCardNumber: '1234567891011',
        creditCardExpiry: '02/23',
        creditCardCvv: '101',
        bankNumber: '1000001',
        consultationPriceCents: 2000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Clara Neo',
        email: 'doctor3@gmail.com',
        password: 'doctor3',
        isDoctor: true,
        doctorRegistrationNumber: '1000003',
        photo: 'doctor3.jpg',
        allergies: 'fur',
        creditCardNumber: '1234567891011',
        creditCardExpiry: '03/23',
        creditCardCvv: '101',
        bankNumber: '1000001',
        consultationPriceCents: 1500,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Dwayne Johnson',
        email: 'doctor4@gmail.com',
        password: 'doctor4',
        isDoctor: true,
        doctorRegistrationNumber: '1000004',
        photo: 'doctor4.jpg',
        allergies: 'fur',
        creditCardNumber: '1234567891011',
        creditCardExpiry: '04/23',
        creditCardCvv: '101',
        bankNumber: '1000001',
        consultationPriceCents: 2000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Evril Ng',
        email: 'doctor5@gmail.com',
        password: 'doctor5',
        isDoctor: true,
        doctorRegistrationNumber: '1000002',
        photo: 'doctor5.jpg',
        allergies: 'fur',
        creditCardNumber: '1234567891011',
        creditCardExpiry: '05/23',
        creditCardCvv: '101',
        bankNumber: '1000001',
        consultationPriceCents: 2000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Francis Bo',
        email: 'doctor6@gmail.com',
        password: 'doctor6',
        isDoctor: true,
        doctorRegistrationNumber: '1000002',
        photo: 'doctor6.jpg',
        allergies: 'fur',
        creditCardNumber: '1234567891011',
        creditCardExpiry: '06/23',
        creditCardCvv: '101',
        bankNumber: '1000001',
        consultationPriceCents: 2000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Gina Tan',
        email: 'doctor7@gmail.com',
        password: 'doctor7',
        isDoctor: true,
        doctorRegistrationNumber: '1000002',
        photo: 'doctor7.jpg',
        allergies: 'fur',
        creditCardNumber: '1234567891011',
        creditCardExpiry: '07/23',
        creditCardCvv: '101',
        bankNumber: '1000001',
        consultationPriceCents: 2000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await queryInterface.bulkInsert(
      'Users',
      doctorsInfo,
      { returning: true },
    );

    const patientsInfo = [
      {
        name: 'Henry Park',
        email: 'patient1@gmail.com',
        password: 'patient1',
        isDoctor: false,
        photo: 'patient1.jpg',
        allergies: 'panadol',
        creditCardNumber: '1234567891011',
        creditCardExpiry: '01/23',
        creditCardCvv: '101',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Isabella Lin',
        email: 'patient2@gmail.com',
        password: 'patient2',
        isDoctor: false,
        photo: 'patient2.jpg',
        allergies: 'panadol',
        creditCardNumber: '1234567891011',
        creditCardExpiry: '01/23',
        creditCardCvv: '101',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Jackie Chan',
        email: 'patient3@gmail.com',
        password: 'patient3',
        isDoctor: false,
        allergies: 'panadol',
        creditCardNumber: '1234567891011',
        creditCardExpiry: '01/23',
        creditCardCvv: '101',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await queryInterface.bulkInsert(
      'Users',
      patientsInfo,
      { returning: true },
    );

    const clinicsInfo = [
      {
        name: 'Pinnacle Family Clinic',
        photo: 'pinnacle.jpg',
        address: 'blk 765 sengkang east road',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Mutal Healthcare',
        photo: 'mutual.jpg',
        address: 'blk 500 shenton road',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Faith Healthcare',
        photo: 'faith.jpg',
        address: 'blk 400 tampines east street',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'My Family Clinic',
        photo: 'my-family.jpg',
        address: 'blk 600 hougang way',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await queryInterface.bulkInsert(
      'Clinics',
      clinicsInfo,
      { returning: true },
    );

    const clinicDoctorsInfo = [
      {
        ClinicId: 1,
        DoctorId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ClinicId: 1,
        DoctorId: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ClinicId: 1,
        DoctorId: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ClinicId: 2,
        DoctorId: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ClinicId: 2,
        DoctorId: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ClinicId: 3,
        DoctorId: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ClinicId: 3,
        DoctorId: 6,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ClinicId: 4,
        DoctorId: 7,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Insert clinicsDoctors last because it reference Users and Clinics
    await queryInterface.bulkInsert(
      'ClinicDoctors',
      clinicDoctorsInfo,
      { returning: true },
    );
  },

  down: async (queryInterface) => {
    // Delete CLinicDoctors before Clinics and Users because
    // ClinicDoctors reference CLinics and Users
    await queryInterface.bulkDelete('ClinicsDoctors', null, {});
    await queryInterface.bulkDelete('Clinics', null, {});
    await queryInterface.bulkDelete('Users', null, {});
  },
};
