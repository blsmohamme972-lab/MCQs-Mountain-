// Request-local D1 accounting. Never log SQL, bind values, Telegram data or IDs.
export function meterDatabase(database) {
  const totals={rows_read:0,rows_written:0,queries:0,available:true,size_after:null};
  function record(result){
    totals.queries++;
    if(!Number.isFinite(result?.meta?.rows_read)||!Number.isFinite(result?.meta?.rows_written))totals.available=false;
    else{totals.rows_read+=result.meta.rows_read;totals.rows_written+=result.meta.rows_written;}
    if(Number.isFinite(result?.meta?.size_after))totals.size_after=result.meta.size_after;
    return result;
  }
  function statement(raw){
    return {bind(...args){return statement(raw.bind(...args))},
      async all(){return record(await raw.all())},
      async run(){return record(await raw.run())},
      // all() preserves metadata that first() otherwise discards.
      async first(column){const result=record(await raw.all()),row=result.results?.[0];return column?row?.[column]??null:row??null},
      _raw:raw};
  }
  const db={prepare(sql){return statement(database.prepare(sql))},
    async batch(statements){const results=await database.batch(statements.map(s=>s._raw));return results.map(record)}};
  return {db,totals};
}
export async function logD1Request(database,path,totals,status) {
  const day=new Date().toISOString().slice(0,10);
  console.log(JSON.stringify({event:'d1_endpoint_usage',endpoint:path,day,status,
    queries:totals.queries,rows_read:totals.available?totals.rows_read:null,
    rows_written:totals.available?totals.rows_written:null}));
  if(path!=='/api/leaderboard/submit'||!totals.queries)return;
  try {
    const result=await database.prepare(`INSERT INTO leaderboard_submission_usage
      (day,submissions,measured_submissions,rows_read,rows_written,max_rows_read) VALUES(?,1,?,?,?,?)
      ON CONFLICT(day) DO UPDATE SET submissions=submissions+1,
      measured_submissions=measured_submissions+excluded.measured_submissions,
      rows_read=rows_read+excluded.rows_read,rows_written=rows_written+excluded.rows_written,
      max_rows_read=MAX(max_rows_read,excluded.max_rows_read)`)
      .bind(day,totals.available?1:0,totals.available?totals.rows_read:0,
        totals.available?totals.rows_written:0,totals.available?totals.rows_read:0).run();
    console.log(JSON.stringify({event:'d1_telemetry_usage',endpoint:path,day,
      rows_read:result.meta?.rows_read??null,rows_written:result.meta?.rows_written??null}));
  } catch {console.log(JSON.stringify({event:'d1_telemetry_unavailable',endpoint:path,day}));}
}
