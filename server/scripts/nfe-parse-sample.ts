import { parseNFeXml } from "../services/nfe-parser";

const sample = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35251112345678900011550010001234567890123456" versao="4.00">
      <ide>
        <nNF>12345</nNF>
        <serie>1</serie>
        <dhEmi>2025-11-10T10:30:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Fornecedor Exemplo SA</xNome>
      </emit>
      <dest>
        <CNPJ>99887766000155</CNPJ>
        <xNome>Empresa Destinatária</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <xProd>Cimento CP-II 50kg</xProd>
          <NCM>25232910</NCM>
          <CFOP>1556</CFOP>
          <uCom>SC</uCom>
          <qCom>50.0000</qCom>
          <vUnCom>39.600000</vUnCom>
          <vProd>1980.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <pICMS>18.00</pICMS>
              <vICMS>356.40</vICMS>
            </ICMS00>
          </ICMS>
          <IPI>
            <IPITrib>
              <pIPI>5.00</pIPI>
              <vIPI>99.00</vIPI>
            </IPITrib>
          </IPI>
          <PIS>
            <PISAliq>
              <pPIS>1.65</pPIS>
              <vPIS>32.67</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <pCOFINS>7.60</pCOFINS>
              <vCOFINS>150.48</vCOFINS>
            </COFINSAliq>
          </COFINS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vProd>1980.00</vProd>
          <vNF>2079.00</vNF>
          <vIPI>99.00</vIPI>
        </ICMSTot>
      </total>
      <cobr>
        <dup>
          <nDup>1</nDup>
          <dVenc>2025-12-10</dVenc>
          <vDup>1039.50</vDup>
        </dup>
        <dup>
          <nDup>2</nDup>
          <dVenc>2026-01-10</dVenc>
          <vDup>1039.50</vDup>
        </dup>
      </cobr>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>35251112345678900011550010001234567890123456</chNFe></infProt></protNFe>
</nfeProc>`;

const result = parseNFeXml(sample);
console.log(JSON.stringify(result, null, 2));

