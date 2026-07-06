// Validadores puros (algoritmo padrão de dígito verificador mod-11), sem dependências externas.
// Usados pelo Lab (demo ao vivo) e pelo Challenge Arena (desafie meu código).

export function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isValidCPF(rawValue) {
  const cpf = onlyDigits(rawValue);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digits = cpf.split("").map(Number);

  function checkDigit(sliceLength) {
    let sum = 0;
    for (let i = 0; i < sliceLength; i++) {
      sum += digits[i] * (sliceLength + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  }

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

export function isValidCNPJ(rawValue) {
  const cnpj = onlyDigits(rawValue);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const digits = cnpj.split("").map(Number);

  function checkDigit(sliceLength) {
    const weights =
      sliceLength === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < sliceLength; i++) {
      sum += digits[i] * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  }

  return checkDigit(12) === digits[12] && checkDigit(13) === digits[13];
}
