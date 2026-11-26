(function(){
'use strict';
const el=id=>document.getElementById(id), ids=['tariff','hours','days','investment','maintenance','life','tax'];
const {constants:C,targetSpeed}=window.FajaPhysics;
const format=(v,d=0)=>Number(v).toLocaleString('es-PE',{minimumFractionDigits:d,maximumFractionDigits:d});
const money=v=>'S/ '+format(v,0);
function power(flow,speed){
 const mass=flow*C.length/(3600*speed);
 return (C.emptyKW+C.loadKW*mass/C.nominalLoad)*speed/C.maxSpeed+mass*C.gravity*Math.sin(C.inclineDeg*Math.PI/180)*speed;
}
function render(){
 const values=ids.map(id=>el(id).valueAsNumber);
 const invalid=ids.some((id,i)=>!Number.isFinite(values[i])||!el(id).validity.valid);
 el('inputError').hidden=!invalid;
 if(invalid)return;
 const [tariff,hours,days,investment,maintenance,life,tax]=values;
 const flow=Number(el('flowRange').value), fixedPower=power(flow,C.maxSpeed), autoPower=power(flow,targetSpeed(flow));
 const annualHours=hours*days, ef=fixedPower*annualHours, ea=autoPower*annualHours;
 const saved=ef-ea, revenue=saved*tariff, dep=investment/life, ebit=revenue-maintenance-dep;
 const taxValue=Math.max(0,ebit)*tax/100, net=ebit-taxValue, cash=revenue-maintenance-taxValue;
 el('savingKwh').textContent=format(saved); el('savingMoney').textContent=money(revenue);
 el('savingPct').textContent=ef>0?format(saved/ef*100,1)+' %':'—';
 el('payback').textContent=cash>0?format(investment/cash,1)+' años':'No se recupera';
 el('baseEnergy').textContent=format(ef)+' kWh';el('autoEnergyAnnual').textContent=format(ea)+' kWh';
 const max=Math.max(ef,ea,1); el('baseBar').style.width=(100*ef/max)+'%';el('autoBar').style.width=(100*ea/max)+'%';
 el('baseCost').textContent=money(ef*tariff);el('autoCost').textContent=money(ea*tariff);
 el('powerPair').textContent=format(fixedPower,1)+' kW / '+format(autoPower,1)+' kW';
 el('energyExplain').textContent=annualHours===0?'Ingresa horas y días de operación para calcular el consumo.':`En este escenario se estiman ${format(Math.abs(saved))} kWh ${saved>=0?'menos':'más'} por año.`;
 for(const [id,v] of Object.entries({tSavings:revenue,tMaintenance:-maintenance,tDep:-dep,tEbit:ebit,tTax:-taxValue,tNet:net,cashFlow:cash}))el(id).textContent=money(v);
}
ids.forEach(id=>el(id).addEventListener('input',render));
el('flowRange').addEventListener('input',render);
document.querySelectorAll('[data-flow]').forEach(b=>b.addEventListener('click',render));
el('weightForm').addEventListener('submit',render);
render();
})();
