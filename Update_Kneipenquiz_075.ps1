$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$paths = @('app.js','profiles.js','index.html','service-worker.js')
$updated = @{}
foreach($name in $paths){
  $path=Join-Path $Root $name
  if(!(Test-Path -LiteralPath $path)) { throw "Datei fehlt: $name. Bitte Update in den echten GitHub-Repository-Ordner kopieren." }
  $updated[$name]=[System.IO.File]::ReadAllText($path).Replace("`r`n","`n")
}
if($updated['index.html'].Contains('v=075')){
  Write-Host '0.7.5 scheint bereits installiert zu sein.' -ForegroundColor Yellow
  exit 0
}
if(!$updated['index.html'].Contains('v=074')){
  throw 'Dieses Update erwartet Kneipenquiz 0.7.4. Der Repo-Ordner enthaelt eine andere Version. Nichts wurde geaendert.'
}
function ReplaceOnce([string]$source,[string]$old,[string]$replacement,[string]$file){
  $idx=$source.IndexOf($old,[System.StringComparison]::Ordinal)
  if($idx -lt 0){throw "Patchstelle nicht gefunden in $file. Nichts wurde veraendert."}
  $next=$source.IndexOf($old,$idx+$old.Length,[System.StringComparison]::Ordinal)
  if($next -ge 0){throw "Patchstelle in $file mehrfach gefunden. Nichts wurde veraendert."}
  return $source.Replace($old,$replacement)
}

$oldText=@'
    if(vals.includes(n)) return true;
    // Buchstaben-Tippfehler dulden, aber niemals Ziffern oder falsche Zahlenwerte.
'@
$newText=@'
    if(vals.includes(n)) return true;
    if(sameNumericalAnswer(input,[expected,...aliases])) return true;
    // Buchstaben-Tippfehler dulden, aber niemals Ziffern oder falsche Zahlenwerte.
'@
$updated['app.js']=ReplaceOnce $updated['app.js'] $oldText $newText 'app.js'

$oldText=@'
  function simpleMatch(
'@
$newText=@'
  // 0.7.5: Zahlen und ausgeschriebene deutsche Zahlwoerter gleich bewerten.
  // Nur VOLLSTAENDIGE Zahlenangaben sind gueltig, niemals Teile eines Satzes.
  function germanIntegerLiteral(input){
    const raw=String(input??'').trim().toLocaleLowerCase('de-DE').replace(/[.!?]+$/,'').trim();
    if (/^\+?(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(raw)) return Number(raw.replace(/\./g,''));
    const w=raw.replace(/[\s-]/g,'').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
    if(!/^[a-z]+$/.test(w))return null;
    const units={null:0,zero:0,ein:1,eins:1,eine:1,einen:1,zwei:2,drei:3,vier:4,
      fuenf:5,sechs:6,sieben:7,acht:8,neun:9,zehn:10,elf:11,zwoelf:12,
      dreizehn:13,vierzehn:14,fuenfzehn:15,sechzehn:16,siebzehn:17,
      achtzehn:18,neunzehn:19};
    const tens={zwanzig:20,dreissig:30,vierzig:40,fuenfzig:50,sechzig:60,
      siebzig:70,achtzig:80,neunzig:90};
    const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
    function below100(s){
      if(has(units,s))return units[s];
      if(has(tens,s))return tens[s];
      for(const [name,val] of Object.entries(tens)){
        if(!s.endsWith(name))continue;
        const left=s.slice(0,-name.length);
        if(!left.endsWith('und'))continue;
        const u=left.slice(0,-3);
        if(has(units,u)&&units[u]>=1&&units[u]<=9)return val+units[u];
      }
      return null;
    }
    function below1000(s){
      if(!s)return 0;
      const at=s.indexOf('hundert');
      if(at===-1)return below100(s);
      const prefix=s.slice(0,at),rest=s.slice(at+7);
      const h=prefix?below100(prefix):1;
      const tail=rest?below100(rest):0;
      return h!==null&&h>=1&&h<=19&&tail!==null?h*100+tail:null;
    }
    const at=w.indexOf('tausend');
    if(at===-1)return below1000(w);
    const prefix=w.slice(0,at),rest=w.slice(at+7);
    const thousands=prefix?below1000(prefix):1,remaining=below1000(rest);
    return thousands!==null&&thousands>=1&&thousands<=999&&remaining!==null
      ?thousands*1000+remaining:null;
  }
  function sameNumericalAnswer(input,answers){
    const given=germanIntegerLiteral(input);
    return given!==null&&answers.some(answer=>{
      const wanted=germanIntegerLiteral(answer);
      return wanted!==null&&wanted===given;
    });
  }

  function simpleMatch(
'@
$updated['app.js']=ReplaceOnce $updated['app.js'] $oldText $newText 'app.js'

$oldText=@'
      await profiles.flush();
      await profiles.refresh();
      const day=profiles.getDaily();
'@
$newText=@'
      // Vor dem Start keine komplette Statistik-Synchronisierung abwarten.
      // Der Server prueft die eindeutige Tages-Reservierung weiterhin selbst.
      const berlinDay=new Intl.DateTimeFormat('sv-SE',{
        timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'
      }).format(new Date());
      const day=profiles.getDaily();
'@
$updated['app.js']=ReplaceOnce $updated['app.js'] $oldText $newText 'app.js'

$oldText=@'
      const questions=dailyQuestions(day.dayKey);
'@
$newText=@'
      const questions=dailyQuestions(berlinDay);
'@
$updated['app.js']=ReplaceOnce $updated['app.js'] $oldText $newText 'app.js'

$oldText=@'
      const reservation=await profiles.reserveDaily(newSession);
      await profiles.refresh();
      const saved=profiles.getDaily();
'@
$newText=@'
      // Bestehende Runde vor dem Fortsetzen einmal aktualisieren,
      // neue Runde startet unmittelbar nach bestaetigter Reservierung.
      if(day.reservedSessionId)await profiles.refresh();
      const reservation=await profiles.reserveDaily(newSession);
      const saved=profiles.getDaily();
      if(saved.completed)throw Error('Das heutige Tagesquiz wurde bereits abgeschlossen.');
'@
$updated['app.js']=ReplaceOnce $updated['app.js'] $oldText $newText 'app.js'

$oldText=@'
  profiles.init().then(() => {
    renderGate();
    show('playerGate');
  });
'@
$newText=@'
  // Bereits bekannte Spieler SOFORT anzeigen; langsamer Google-Abgleich im Hintergrund.
  renderGate();
  show('playerGate');
  profiles.init().then(()=>renderGate()).catch(err=>{
    console.warn('Spielerdaten werden im Hintergrund aktualisiert:',err);
    renderGate();
  });
'@
$updated['app.js']=ReplaceOnce $updated['app.js'] $oldText $newText 'app.js'

$oldText=@'
    state.activeId = playerId; persist(); notify();
    if (central) await refresh().catch(() => {});
    return getActive();
'@
$newText=@'
    state.activeId = playerId;
    // Tagesergebnis ist spielerbezogen und darf nicht vom vorherigen Spieler bleiben.
    if(central)state.remoteDaily=null;
    persist(); notify();
    // Spielerwahl nie durch einen Google-Snapshot blockieren.
    if(central){
      const previous=refreshInFlight;
      Promise.resolve().then(async()=>{
        if(previous)await previous.catch(()=>{});
        await refresh().catch(()=>{});
      });
    }
    return getActive();
'@
$updated['profiles.js']=ReplaceOnce $updated['profiles.js'] $oldText $newText 'profiles.js'

$oldText=@'
        state.remoteDaily = data.daily || null;
        state.dayKey = data.dayKey || state.dayKey || '';
'@
$newText=@'
        // Langsame Antworten eines frueheren Spielerprofils nicht zuordnen.
        if(playerId===state.activeId)state.remoteDaily = data.daily || null;
        state.dayKey = data.dayKey || state.dayKey || '';
'@
$updated['profiles.js']=ReplaceOnce $updated['profiles.js'] $oldText $newText 'profiles.js'

$oldText=@'
  async function reserveDaily(sessionId) {
    if (!central || !online || getBackendVersion() !== '0.7' || state.backendBuild !== '0.7.2') throw new Error('Tagesquiz benötigt Apps Script 0.7.2 und eine Serververbindung.');
    await refresh();
    const dayKey = state.dayKey;
    if (!dayKey) throw new Error('Kein gültiger Quiztag vom Server empfangen.');
    // Vorhandene Serverreservierung niemals duplizieren: dieselbe Runde fortsetzen.
    if (state.remoteDaily?.reservedSessionId) return {dayKey,sessionId:state.remoteDaily.reservedSessionId};
    await send([{kind:'dailyStart',playerId:state.activeId,sessionId,dayKey}]);
    for (let i=0;i<7;i++) {
      await wait(350+i*250);
      await refresh();
      if (state.remoteDaily?.reservedSessionId) {
        return {dayKey,sessionId:state.remoteDaily.reservedSessionId};
      }
    }
    throw new Error('Der Quizstart wurde nicht bestätigt. Bitte die Seite aktualisieren – keine weitere Reservierung erzeugen.');
  }
'@
$newText=@'
  async function reserveDaily(sessionId) {
    if (!central || !online || getBackendVersion() !== '0.7' || state.backendBuild !== '0.7.2')
      throw new Error('Tagesquiz benötigt Apps Script 0.7.2 und eine Serververbindung.');
    const berlinDay=new Intl.DateTimeFormat('sv-SE',{
      timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'
    }).format(new Date());
    // Nur bei fehlendem oder veraltetem Tages-/Spielerstand den grossen Snapshot laden.
    if(state.dayKey!==berlinDay || !state.remoteDaily)await refresh();
    const dayKey=state.dayKey;
    if(dayKey!==berlinDay)throw new Error('Der Server hat keinen gueltigen Berliner Quiztag bestaetigt.');
    if(state.remoteDaily?.reservedSessionId)
      return {dayKey,sessionId:state.remoteDaily.reservedSessionId};
    await send([{kind:'dailyStart',playerId:state.activeId,sessionId,dayKey}]);
    // ACK liest nur die registrierten Ereignis-IDs und ist deutlich schlanker
    // als die mehrfache Berechnung der vollstaendigen Rangliste.
    for(let attempt=0;attempt<6;attempt++){
      await wait(250+attempt*200);
      try {
        const ack=await jsonp('ack',{ids:sessionId});
        if((ack.ids||[]).includes(sessionId)){
          state.remoteDaily={...(state.remoteDaily||{}),dayKey,
            reservedSessionId:sessionId,completed:false,result:null};
          persist();notify();
          // Ergebnisse/Rangliste spaeter aktualisieren, Start nicht aufhalten.
          refresh().catch(()=>{});
          return {dayKey,sessionId};
        }
      }catch(err){if(attempt===5)console.warn('Tagesquiz-Bestaetigung:',err);}
    }
    // Falls ein anderes Geraet die Tagesrunde zuerst angelegt hat:
    await refresh();
    if(state.remoteDaily?.reservedSessionId)
      return {dayKey,sessionId:state.remoteDaily.reservedSessionId};
    throw new Error('Tagesquiz-Reservierung noch nicht bestaetigt. Bitte aktualisieren, nicht erneut mehrfach starten.');
  }
'@
$updated['profiles.js']=ReplaceOnce $updated['profiles.js'] $oldText $newText 'profiles.js'

# Versionsnummern / PWA-Cache erneuern, damit Geraete nicht bei alten Dateien bleiben.
foreach($name in @('index.html','service-worker.js')){
  $updated[$name]=$updated[$name].Replace('v=074','v=075').Replace('0.7.4','0.7.5').Replace('V074','V075')
}
$updated['app.js']=$updated['app.js'].Replace('KNEIPENQUIZ_V074','KNEIPENQUIZ_V075')
if(!$updated['index.html'].Contains('v=075') -or !$updated['service-worker.js'].Contains('v=075')){
  throw 'Versionspruefung gescheitert. Nichts wurde veraendert.'
}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot=Join-Path $env:LOCALAPPDATA 'Kneipenquiz\Backups'
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$backup=Join-Path $backupRoot "Sicherung-vor-075-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null
foreach($name in $paths){Copy-Item -LiteralPath (Join-Path $Root $name) -Destination $backup}
$enc=[System.Text.UTF8Encoding]::new($false)
foreach($name in $paths){[System.IO.File]::WriteAllText((Join-Path $Root $name),$updated[$name],$enc)}
Write-Host ''
Write-Host 'KNEIPENQUIZ 0.7.5 erfolgreich eingebaut.' -ForegroundColor Green
Write-Host "Sicherung: $backup"
Write-Host 'Danach: GitHub Desktop -> Commit -> Push origin.'
