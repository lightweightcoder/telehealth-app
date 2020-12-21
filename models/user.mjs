export default function userModel(sequelize, DataTypes) {
  return sequelize.define('User', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    name: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    email: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    password: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    isDoctor: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
    },
    doctorRegistrationNumber: {
      type: DataTypes.STRING,
    },
    photo: {
      type: DataTypes.STRING,
    },
    allergies: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    creditCardNumber: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    creditCardExpiry: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    creditCardCvv: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    bankNumber: {
      type: DataTypes.STRING,
    },
    consultationPriceCents: {
      type: DataTypes.INTEGER,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  });
}
