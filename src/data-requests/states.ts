import axios from "axios";
import {
  getDateBefore,
  getStateAbbreviationById,
  RKIError,
  getAlternateDataSource,
  parseDate,
  shouldUseAlternateDataSource,
} from "../utils";
import { ResponseData } from "./response-data";

export interface IStateData {
  id: number;
  name: string;
  population: number;
  cases: number;
  deaths: number;
  casesPerWeek: number;
  deathsPerWeek: number;
  lastUpdated: number;
}

export async function getStatesData(): Promise<ResponseData<IStateData[]>> {
  const response = await axios.get(
    `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Coronaf%C3%A4lle_in_den_Bundesl%C3%A4ndern/FeatureServer/0/query?where=1%3D1&outFields=LAN_ew_EWZ,LAN_ew_AGS,Fallzahl,Aktualisierung,Death,cases7_bl,death7_bl,LAN_ew_GEN&returnGeometry=false&f=json`
  );
  const data = response.data;
  if (data.error) {
    throw new RKIError(data.error, response.config.url);
  }
  const states = data.features.map((feature) => {
    return {
      id: parseInt(feature.attributes.LAN_ew_AGS),
      name: feature.attributes.LAN_ew_GEN,
      population: feature.attributes.LAN_ew_EWZ,
      cases: feature.attributes.Fallzahl,
      deaths: feature.attributes.Death,
      casesPerWeek: feature.attributes.cases7_bl,
      deathsPerWeek: feature.attributes.death7_bl,
    };
  });
  return {
    data: states,
    lastUpdate: new Date(
      data.features[0].attributes.Aktualisierung + 60 * 60 * 1000
    ),
  };
}

export async function getStatesRecoveredData(): Promise<
  ResponseData<{ id: number; recovered: number }[]>
> {
  const url = `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Covid19_hubv/FeatureServer/0/query?where=NeuGenesen IN(1,0)&objectIds=&time=&resultType=standard&outFields=AnzahlGenesen,MeldeDatum,IdBundeland,Datenstand&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=IdBundesland&groupByFieldsForStatistics=IdBundesland,Datenstand&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlGenesen","outStatisticFieldName":"recovered"},{"statisticType":"max","onStatisticField":"MeldeDatum","outStatisticFieldName":"date"}]&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=json&token=`;
  const response = await axios.get(url);
  let data = response.data;
  if (data.error) {
    throw new RKIError(data.error, response.config.url);
  }
  let datenstand = parseDate(data.features[0].attributes.Datenstand);
  if (shouldUseAlternateDataSource(datenstand)) {
    data = await getAlternateDataSource(url);
    datenstand = parseDate(data.features[0].attributes.Datenstand);
  }
  const states = data.features.map((feature) => {
    return {
      id: feature.attributes.IdBundesland,
      recovered: feature.attributes.recovered,
    };
  });
  return {
    data: states,
    lastUpdate: datenstand,
  };
}

export async function getNewStateRecovered(): Promise<
  ResponseData<{ id: number; recovered: number }[]>
> {
  const url = `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Covid19_hubv/FeatureServer/0/query?where=NeuGenesen IN(1,-1)&objectIds=&time=&resultType=standard&outFields=AnzahlGenesen,MeldeDatum,IdBundeland,Datenstand&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=IdBundesland&groupByFieldsForStatistics=IdBundesland,Datenstand&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlGenesen","outStatisticFieldName":"recovered"},{"statisticType":"max","onStatisticField":"MeldeDatum","outStatisticFieldName":"date"}]&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=json&token=`;
  const response = await axios.get(url);
  let data = response.data;
  if (data.error) {
    throw new RKIError(data.error, response.config.url);
  }
  if (data.features.length == 0) {
    // This meens there are no new recovered in all states!
    // but we need the field "Datenstand" from the rki Data Base so
    // lets request the total recovered (there is always a result!)
    // and "build" a result with "total recovered Datenstand" and "new recovered = 0"
    const url2 = `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Covid19_hubv/FeatureServer/0/query?where=NeuGenesen IN(1,0)&objectIds=&time=&resultType=standard&outFields=AnzahlGenesen,MeldeDatum,IdBundeland,Datenstand&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=IdBundesland&groupByFieldsForStatistics=IdBundesland,Datenstand&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlGenesen","outStatisticFieldName":"recovered"},{"statisticType":"max","onStatisticField":"MeldeDatum","outStatisticFieldName":"date"}]&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=json&token=`;
    const response2 = await axios.get(url2);
    const data2 = response2.data;
    if (data2.error) {
      throw new RKIError(data2.error, response2.config.url);
    }
    data.features[0] = {
      attributes: {
        IdBundesland: 1,
        recovered: 0,
        Datenstand: data2.features[0].attributes.Datenstand,
      },
    };
  }
  let datenstand = parseDate(data.features[0].attributes.Datenstand);
  if (shouldUseAlternateDataSource(datenstand)) {
    data = await getAlternateDataSource(url);
    datenstand = parseDate(data.features[0].attributes.Datenstand);
  }
  const states = data.features.map((feature) => {
    return {
      id: feature.attributes.IdBundesland,
      recovered: feature.attributes.recovered,
    };
  });
  return {
    data: states,
    lastUpdate: datenstand,
  };
}

export async function getNewStateCases(): Promise<
  ResponseData<{ id: number; cases: number }[]>
> {
  const url = `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Covid19_hubv/FeatureServer/0/query?where=NeuerFall IN(1,-1)&objectIds=&time=&resultType=standard&outFields=AnzahlFall,MeldeDatum,IdBundeland,Datenstand&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=IdBundesland&groupByFieldsForStatistics=IdBundesland,Datenstand&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlFall","outStatisticFieldName":"cases"},{"statisticType":"max","onStatisticField":"MeldeDatum","outStatisticFieldName":"date"}]&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=json&token=`;
  const response = await axios.get(url);
  let data = response.data;
  if (data.error) {
    throw new RKIError(data.error, response.config.url);
  }
  if (data.features.length == 0) {
    // This meens there are no new cases in all states!
    // but we need the field "Datenstand" from the rki Data Base so
    // lets request the total cases (there is always a result!)
    // and "build" a result with "total cases Datenstand" and "new cases = 0"
    const url2 = `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Covid19_hubv/FeatureServer/0/query?where=NeuerFall IN(1,0)&objectIds=&time=&resultType=standard&outFields=AnzahlFall,MeldeDatum,IdBundeland,Datenstand&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=IdBundesland&groupByFieldsForStatistics=IdBundesland,Datenstand&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlFall","outStatisticFieldName":"cases"},{"statisticType":"max","onStatisticField":"MeldeDatum","outStatisticFieldName":"date"}]&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=json&token=`;
    const response2 = await axios.get(url2);
    const data2 = response2.data;
    if (data2.error) {
      throw new RKIError(data2.error, response2.config.url);
    }
    data.features[0] = {
      attributes: {
        IdBundesland: 1,
        cases: 0,
        Datenstand: data2.features[0].attributes.Datenstand,
      },
    };
  }
  let datenstand = parseDate(data.features[0].attributes.Datenstand);
  if (shouldUseAlternateDataSource(datenstand)) {
    data = await getAlternateDataSource(url);
    datenstand = parseDate(data.features[0].attributes.Datenstand);
  }
  const states = data.features.map((feature) => {
    return {
      id: feature.attributes.IdBundesland,
      cases: feature.attributes.cases,
    };
  });
  return {
    data: states,
    lastUpdate: datenstand,
  };
}

export async function getNewStateDeaths(): Promise<
  ResponseData<{ id: number; deaths: number }[]>
> {
  const url = `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Covid19_hubv/FeatureServer/0/query?where=NeuerTodesfall IN(1,-1)&objectIds=&time=&resultType=standard&outFields=AnzahlTodesfall,MeldeDatum,IdBundeland,Datenstand&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=IdBundesland&groupByFieldsForStatistics=IdBundesland,Datenstand&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlTodesfall","outStatisticFieldName":"deaths"},{"statisticType":"max","onStatisticField":"MeldeDatum","outStatisticFieldName":"date"}]&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=json&token=`;
  const response = await axios.get(url);
  let data = response.data;
  if (data.error) {
    throw new RKIError(data.error, response.config.url);
  }
  // check if there is a result
  if (data.features.length == 0) {
    // This meens there are no new deaths in all states!
    // if not, we need the field "Datenstand" from the rki Data Base so
    // lets request the total deaths (there is always a result!)
    // and "build" one result with "total deaths Datenstand" and "new deaths = 0" and "IdBundesland=1"
    const url2 = `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Covid19_hubv/FeatureServer/0/query?where=NeuerTodesfall IN(1,0)&objectIds=&time=&resultType=standard&outFields=AnzahlTodesfall,MeldeDatum,IdBundeland,Datenstand&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=IdBundesland&groupByFieldsForStatistics=IdBundesland,Datenstand&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlTodesfall","outStatisticFieldName":"deaths"},{"statisticType":"max","onStatisticField":"MeldeDatum","outStatisticFieldName":"date"}]&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=json&token=`;
    const response2 = await axios.get(url2);
    const data2 = response2.data;
    if (data2.error) {
      throw new RKIError(data2.error, response2.config.url);
    }
    data.features[0] = {
      attributes: {
        IdBundesland: 1,
        deaths: 0,
        Datenstand: data2.features[0].attributes.Datenstand,
      },
    };
  }
  let datenstand = parseDate(data.features[0].attributes.Datenstand);
  if (shouldUseAlternateDataSource(datenstand)) {
    const data2 = await getAlternateDataSource(url);
    if (data2.features.length > 0) {
      data = data2;
      datenstand = parseDate(data2.features[0].attributes.Datenstand);
    }
  }
  const states = data.features.map((feature) => {
    return {
      id: feature.attributes.IdBundesland,
      deaths: feature.attributes.deaths,
    };
  });
  return {
    data: states,
    lastUpdate: datenstand,
  };
}

export async function getLastStateCasesHistory(
  days?: number,
  id?: number
): Promise<
  ResponseData<{ id: number; name: string; cases: number; date: Date }[]>
> {
  const whereParams = [`NeuerFall IN(1,0)`];
  if (days) {
    const dateString = getDateBefore(days);
    whereParams.push(`MeldeDatum >= TIMESTAMP '${dateString}'`);
  }
  if (id) {
    whereParams.push(`IdBundesland = ${id}`);
  }
  const url = `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Covid19_hubv/FeatureServer/0/query?where=${whereParams.join(
    " AND "
  )}&objectIds=&time=&resultType=standard&outFields=AnzahlFall,MeldeDatum,Bundesland,IdBundesland,Datenstand&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=IdBundesland,MeldeDatum&groupByFieldsForStatistics=IdBundesland,MeldeDatum,Bundesland,Datenstand&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlFall","outStatisticFieldName":"cases"}]&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=json&token=`;

  const response = await axios.get(url);
  let data = response.data;
  if (data.error) {
    throw new RKIError(data.error, response.config.url);
  }
  let datenstand = parseDate(data.features[0].attributes.Datenstand);
  if (shouldUseAlternateDataSource(datenstand)) {
    const blId = id ? id.toString().padStart(2, "0") : null;
    data = await getAlternateDataSource(url, blId);
    datenstand = parseDate(data.features[0].attributes.Datenstand);
  }
  const history: {
    id: number;
    name: string;
    cases: number;
    date: Date;
  }[] = data.features.map((feature) => {
    return {
      id: feature.attributes.IdBundesland,
      name: feature.attributes.Bundesland,
      cases: feature.attributes.cases,
      date: new Date(feature.attributes.MeldeDatum),
    };
  });

  return {
    data: history,
    lastUpdate: datenstand,
  };
}

export async function getLastStateDeathsHistory(
  days?: number,
  id?: number
): Promise<
  ResponseData<{ id: number; name: string; deaths: number; date: Date }[]>
> {
  const whereParams = [`NeuerTodesfall IN(1,0,-9)`];
  if (days) {
    const dateString = getDateBefore(days);
    whereParams.push(`MeldeDatum >= TIMESTAMP '${dateString}'`);
  }
  if (id) {
    whereParams.push(`IdBundesland = ${id}`);
  }
  const url = `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Covid19_hubv/FeatureServer/0/query?where=${whereParams.join(
    " AND "
  )}&objectIds=&time=&resultType=standard&outFields=AnzahlTodesfall,MeldeDatum,Bundesland,IdBundesland,Datenstand&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=IdBundesland,MeldeDatum&groupByFieldsForStatistics=IdBundesland,MeldeDatum,Bundesland,Datenstand&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlTodesfall","outStatisticFieldName":"deaths"}]&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=json&token=`;

  const response = await axios.get(url);
  let data = response.data;
  if (data.error) {
    throw new RKIError(data.error, response.config.url);
  }
  let datenstand = parseDate(data.features[0].attributes.Datenstand);
  if (shouldUseAlternateDataSource(datenstand)) {
    const blId = id ? id.toString().padStart(2, "0") : null;
    data = await getAlternateDataSource(url, blId);
    datenstand = parseDate(data.features[0].attributes.Datenstand);
  }
  const history: {
    id: number;
    name: string;
    deaths: number;
    date: Date;
  }[] = data.features.map((feature) => {
    return {
      id: feature.attributes.IdBundesland,
      name: feature.attributes.Bundesland,
      deaths: feature.attributes.deaths,
      date: new Date(feature.attributes.MeldeDatum),
    };
  });

  return {
    data: history,
    lastUpdate: datenstand,
  };
}

export async function getLastStateRecoveredHistory(
  days?: number,
  id?: number
): Promise<
  ResponseData<{ id: number; name: string; recovered: number; date: Date }[]>
> {
  const whereParams = [`NeuGenesen IN(1,0,-9)`];
  if (days) {
    const dateString = getDateBefore(days);
    whereParams.push(`MeldeDatum >= TIMESTAMP '${dateString}'`);
  }
  if (id) {
    whereParams.push(`IdBundesland = ${id}`);
  }
  const url = `https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Covid19_hubv/FeatureServer/0/query?where=${whereParams.join(
    " AND "
  )}&objectIds=&time=&resultType=standard&outFields=AnzahlGenesen,MeldeDatum,Bundesland,IdBundesland,Datenstand&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=IdBundesland,MeldeDatum&groupByFieldsForStatistics=IdBundesland,MeldeDatum,Bundesland,Datenstand&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlGenesen","outStatisticFieldName":"recovered"}]&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=json&token=`;

  const response = await axios.get(url);
  let data = response.data;
  if (data.error) {
    throw new RKIError(data.error, response.config.url);
  }
  let datenstand = parseDate(data.features[0].attributes.Datenstand);
  if (shouldUseAlternateDataSource(datenstand)) {
    const blId = id ? id.toString().padStart(2, "0") : null;
    data = await getAlternateDataSource(url, blId);
    datenstand = parseDate(data.features[0].attributes.Datenstand);
  }
  const history: {
    id: number;
    name: string;
    recovered: number;
    date: Date;
  }[] = data.features.map((feature) => {
    return {
      id: feature.attributes.IdBundesland,
      name: feature.attributes.Bundesland,
      recovered: feature.attributes.recovered,
      date: new Date(feature.attributes.MeldeDatum),
    };
  });

  return {
    data: history,
    lastUpdate: datenstand,
  };
}

export interface AgeGroupData {
  casesMale: string;
  casesFemale: string;
  deathsMale: string;
  deathsFemale: string;
  casesMalePer100k: string;
  casesFemalePer100k: string;
  deathsMalePer100k: string;
  deathsFemalePer100k: string;
}

export interface AgeGroupsData {
  [key: string]: {
    [key: string]: AgeGroupData;
  };
}

export async function getStatesAgeGroups(
  id?: number
): Promise<ResponseData<AgeGroupsData>> {
  const response = await axios.get(
    "https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/rki_altersgruppen_hubv/FeatureServer/0/query?where=AdmUnitId%3C17&outFields=*&f=json"
  );
  const data = response.data;
  if (data.error) {
    throw new RKIError(data.error, response.config.url);
  }
  const lastModified = response.headers["last-modified"];
  const lastUpdate = lastModified != null ? new Date(lastModified) : new Date();

  const states: AgeGroupsData = {};
  data.features.forEach((feature) => {
    if (!feature.attributes.BundeslandId) return;
    if (id && feature.attributes.BundeslandId != id) return;
    const abbreviation = getStateAbbreviationById(
      feature.attributes.BundeslandId
    );
    if (!states[abbreviation]) states[abbreviation] = {};
    states[abbreviation][feature.attributes.Altersgruppe] = {
      casesMale: feature.attributes.AnzFallM,
      casesFemale: feature.attributes.AnzFallW,
      deathsMale: feature.attributes.AnzTodesfallM,
      deathsFemale: feature.attributes.AnzTodesfallW,
      casesMalePer100k: feature.attributes.AnzFall100kM,
      casesFemalePer100k: feature.attributes.AnzFall100kW,
      deathsMalePer100k: feature.attributes.AnzTodesfall100kM,
      deathsFemalePer100k: feature.attributes.AnzTodesfall100kW,
    };
  });

  return {
    data: states,
    lastUpdate,
  };
}
