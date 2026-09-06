declare module 'qrcode' {
 const QRCode: {toDataURL(text:string,options?:{errorCorrectionLevel?:string,margin?:number,scale?:number}):Promise<string>};
 export default QRCode;
}
