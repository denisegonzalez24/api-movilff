import { executeQuery, LightdataORM } from "lightdata-tools";

export async function preloader({ db, req }) {


  // ================== helper: qué secciones quiere ==================
  const rawSection = req?.query?.sections;

  // null => quiere todo (comportamiento actual)
  const sections =
    rawSection == null
      ? null
      : new Set(
        String(rawSection)
          .split(",")
          .map(s => s.trim().toLowerCase())
          .filter(Boolean)
      );

  const wants = name =>
    sections === null || sections.has(name.toLowerCase()) || sections.has("all");

  // Objeto final a devolver
  const data = {};

  // ================== PRODUCTOS (con insumos + combos) ==================

  // ================== USUARIOS ==================
  let usuarios = [];
  if (wants("usuarios")) {
    const selectUsuario = await LightdataORM.select({ db, table: "usuarios" });
    usuarios = selectUsuario.map(u => ({
      did: u.did,
      nombre: u.nombre,
      apellido: u.apellido,
      habilitado: u.habilitado,
      perfil: u.perfil,
      telefono: u.telefono,
      usuario: u.usuario,
      codigo_cliente: u.codigo_cliente,
      app_habilitada: u.app_habilitada,
      accesos: u.accesos,
      email: u.email,
    }));
    data.usuarios = usuarios;
  }



  // ================== RESPONSE ==================
  return {
    success: true,
    message: "Datos pre-cargados correctamente",
    data,
    meta: { timestamp: new Date().toISOString() },
  };
}

export async function getArmadores({ db }) {
  const armadores = await executeQuery({
    db,
    query: `
      SELECT
        did,
        nombre,
        apellido,
        usuario,
        telefono,
        email
      FROM usuarios
      WHERE perfil = 3
        AND superado = 0
        AND elim = 0
      ORDER BY nombre ASC, apellido ASC
    `,
  });

  return {
    success: true,
    message: "Armadores obtenidos correctamente",
    data: {
      armadores: (armadores ?? []).map((a) => ({
        did: String(a.did ?? ""),
        nombre: a.nombre ?? "",
        apellido: a.apellido ?? "",
        usuario: a.usuario ?? "",
        telefono: a.telefono ?? "",
        email: a.email ?? "",
      })),
    },
    meta: { timestamp: new Date().toISOString() },
  };
}
