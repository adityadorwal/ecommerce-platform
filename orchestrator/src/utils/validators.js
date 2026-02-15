function validateStoreName(name) {
  // Store name validation rules:
  // - Must be lowercase
  // - Only alphanumeric and hyphens
  // - Must start with a letter
  // - 3-63 characters long
  // - Cannot end with a hyphen

  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Store name must be a string' };
  }

  if (name.length < 3 || name.length > 63) {
    return { valid: false, error: 'Store name must be between 3 and 63 characters' };
  }

  const regex = /^[a-z][a-z0-9-]*[a-z0-9]$/;
  if (!regex.test(name)) {
    return {
      valid: false,
      error: 'Store name must start with a letter, contain only lowercase letters, numbers, and hyphens, and cannot end with a hyphen'
    };
  }

  // Reserved names
  const reserved = ['default', 'kube-system', 'kube-public', 'kube-node-lease'];
  if (reserved.includes(name)) {
    return { valid: false, error: 'This store name is reserved' };
  }

  return { valid: true };
}

module.exports = {
  validateStoreName
};
