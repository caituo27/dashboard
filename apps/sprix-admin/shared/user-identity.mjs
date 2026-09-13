const alphabet='abcdefghijklmnopqrstuvwxyz';
const internationalDialingPlans=Object.freeze([
 {countryCode:'44',nationalLength:10,leading:'7'},
 {countryCode:'49',nationalLength:11,leading:'15'},
 {countryCode:'81',nationalLength:10,leading:'70'},
 {countryCode:'971',nationalLength:9,leading:'50'},
]);

function stableHash(value,salt=0){
 let result=(2166136261^salt)>>>0;
 for(const character of String(value??'')){
  result^=character.codePointAt(0);
  result=Math.imul(result,16777619)>>>0;
 }
 return result;
}

function identityNumber(identity){
 const numeric=Number(identity);
 return Number.isSafeInteger(numeric)&&numeric>=0?numeric:stableHash(identity,17);
}

function base26(value,length){
 let current=Math.max(0,value),result='';
 do{result=alphabet[current%alphabet.length]+result;current=Math.floor(current/alphabet.length);}while(current>0);
 return result.padStart(length,'a').slice(-length);
}

export function anonymizedUserName(identity){
 const numeric=Number(identity),space=alphabet.length**10;
 const value=Number.isSafeInteger(numeric)&&numeric>=0
  ?(numeric*4600000001+104729)%space
  :(stableHash(identity,29)*32768+stableHash(identity,71)%32768)%space;
 return base26(value,10);
}

export function virtualPhoneForIdentity(identity){
 const uid=identityNumber(identity),plan=internationalDialingPlans[stableHash(identity,31)%internationalDialingPlans.length];
 const suffix=String(uid%100000).padStart(5,'0'),randomLength=plan.nationalLength-plan.leading.length-suffix.length;
 const randomDigits=Array.from({length:randomLength},(_,index)=>stableHash(identity,41+index)%10).join('');
 return `+${plan.countryCode}${plan.leading}${randomDigits}${suffix}`;
}
