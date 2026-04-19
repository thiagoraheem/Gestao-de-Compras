export const getUserRoles = (user: any) => {
  const roles = [];
  if (user.isAdmin) roles.push("Admin");
  if (user.isManager) roles.push("Gerente");
  if (user.isBuyer) roles.push("Comprador");
  if (user.isApproverA1) roles.push("Aprovador A1");
  if (user.isApproverA2) roles.push("Aprovador A2");
  if (user.isReceiver) roles.push("Recebedor");
  if (user.isCEO) roles.push("CEO");
  if (user.isDirector) roles.push("Diretor");
  return roles;
};
