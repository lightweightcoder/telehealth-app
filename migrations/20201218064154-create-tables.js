module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Tables that are being referenced to by other tables need to be created first
    // for sequelize to know
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      email: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      password: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      isDoctor: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      doctorRegistrationNumber: {
        type: Sequelize.STRING,
      },
      photo: {
        type: Sequelize.STRING,
      },
      allergies: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      creditCardNumber: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      creditCardExpiry: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      creditCardCvv: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      bankNumber: {
        type: Sequelize.STRING,
      },
      consultationPriceCents: {
        type: Sequelize.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable('Clinics', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      photo: {
        type: Sequelize.STRING,
      },
      address: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable('Medications', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      priceCents: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable('Consultations', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      PatientId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      DoctorId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      ClinicId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Clinics',
          key: 'id',
        },
      },
      date: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      status: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      description: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      diagnosis: {
        type: Sequelize.STRING,
      },
      consultationPriceCents: {
        type: Sequelize.INTEGER,
      },
      totalPriceCents: {
        type: Sequelize.INTEGER,
      },
      medicinesPriceCents: {
        type: Sequelize.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable('Messages', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      // By convention, foreign keys in Sequelize are in UpperCamelCase
      SenderId: {
        type: Sequelize.INTEGER,
        // This links the SenderId column to the id column in the Users table
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      ConsultationId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Consultations',
          key: 'id',
        },
      },
      description: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable('Prescriptions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      ConsultationId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Consultations',
          key: 'id',
        },
      },
      MedicineId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Medications',
          key: 'id',
        },
      },
      quantity: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      instruction: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable('ClinicDoctors', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      ClinicId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Clinics',
          key: 'id',
        },
      },
      DoctorId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  // eslint-disable-next-line no-unused-vars
  down: async (queryInterface, Sequelize) => {
    // Tables that have foreign keys have to be dropped first
    // before dropping the tables being referenced to
    await queryInterface.dropTable('ClinicDoctors');
    await queryInterface.dropTable('Prescriptions');
    await queryInterface.dropTable('Messages');
    await queryInterface.dropTable('Consultations');
    await queryInterface.dropTable('Medications');
    await queryInterface.dropTable('Clinics');
    await queryInterface.dropTable('Users');
  },
};
