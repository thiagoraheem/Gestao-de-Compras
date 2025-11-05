// Test script for CPF and CNPJ validators
import { validateCPF, applyCPFMask } from '../client/src/lib/cpf-validator.ts';
import { validateCNPJ, applyCNPJMask } from '../client/src/lib/cnpj-validator.ts';

console.log('Testing CPF Validator...');

// Test valid CPFs
const validCPFs = [
  '52998224725',
  '529.982.247-25',
  '11144477735',
  '111.444.777-35'
];

validCPFs.forEach(cpf => {
  const isValid = validateCPF(cpf);
  const masked = applyCPFMask(cpf);
  console.log(`CPF: ${cpf} -> Valid: ${isValid}, Masked: ${masked}`);
});

// Test invalid CPFs
const invalidCPFs = [
  '00000000000',
  '11111111111',
  '12345678901',
  '52998224726'
];

invalidCPFs.forEach(cpf => {
  const isValid = validateCPF(cpf);
  console.log(`CPF: ${cpf} -> Valid: ${isValid} (should be false)`);
});

console.log('\nTesting CNPJ Validator...');

// Test valid CNPJs
const validCNPJs = [
  '11444777000161',
  '11.444.777/0001-61',
  '12345678000195',
  '12.345.678/0001-95'
];

validCNPJs.forEach(cnpj => {
  const isValid = validateCNPJ(cnpj);
  const masked = applyCNPJMask(cnpj);
  console.log(`CNPJ: ${cnpj} -> Valid: ${isValid}, Masked: ${masked}`);
});

// Test invalid CNPJs
const invalidCNPJs = [
  '00000000000000',
  '11111111111111',
  '12345678901234',
  '11444777000162'
];

invalidCNPJs.forEach(cnpj => {
  const isValid = validateCNPJ(cnpj);
  console.log(`CNPJ: ${cnpj} -> Valid: ${isValid} (should be false)`);
});

console.log('\nTest completed!');