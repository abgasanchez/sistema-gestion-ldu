var LDU = {
  SPREADSHEET_ID: 'REEMPLAZAR_CON_ID_DEL_SPREADSHEET',
  SHEETS: {
    DEVICES: 'LDU_Dispositivos',
    INCIDENTS: 'LDU_Incidencias',
    AUDIT: 'LDU_Historial',
    USERS: 'LDU_Usuarios',
    CATALOGS: 'LDU_Catalogos'
  },
  HEADERS: {
    LDU_Dispositivos: ['device_id','imei','marca','modelo','n_linea','monto','estado','responsable','dni','cargo','tipo','supervisor','zona','departamento','region','city','cuenta','canal','tienda','tipo_uso','fecha_asignacion','observaciones','created_at','updated_at','created_by','updated_by','source_sheet'],
    LDU_Incidencias: ['incident_id','imei_original','tipo','imei_nuevo','tipo_uso_disp','supervisor','nombre','dni','cargo','modelo','fecha','valor','doc_autorizacion','modalidad','estado_proceso','doc_adjunto','observaciones','created_at','updated_at','created_by','updated_by'],
    LDU_Historial: ['event_id','entity_type','entity_id','imei','module','action','before_json','after_json','justification','user_id','timestamp','source'],
    LDU_Usuarios: ['user_id','username','role','name','email','active','created_at','updated_at'],
    LDU_Catalogos: ['catalog','value','label','active']
  }
};
