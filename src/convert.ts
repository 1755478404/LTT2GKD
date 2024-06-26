import json5 from 'json5';
import { RawSubscription, RawApp, RawAppGroup, RawAppRule, IArray } from '@gkd-kit/api';
import { Root } from './types';
import { getJsonArrayLength, iArrayToArray, textRuleConvert, boundsRuleConvert } from './method'
import fs from 'node:fs/promises';

const convert = async () => {
  const AppListFile = await fs.readFile(process.cwd() + '/AppList.json5', 'utf-8');
  const AppExtListFile = await fs.readFile(process.cwd() + '/AppExtList.json5', 'utf-8');
  const lttSub = await fs.readFile(process.cwd() + '/ltt.json', 'utf-8');
  const AppList: Root = json5.parse(AppListFile);
  const AppExtList: Root = json5.parse(AppExtListFile);
  const List = AppList.concat(AppExtList);
  const origin = json5.parse(lttSub);
  const originLength = getJsonArrayLength(origin);
  let throwCount = 0;

  let thisSub: RawSubscription = {
    id: -2,
    name: '本地订阅',
    version: 0,
    author: 'gkd',
    globalGroups: [],
    categories: [],
    apps: [],
  };

  origin.forEach((a: any) => {
    if(Object.keys(a)[0].match(/-?[0-9]+/) === null) return;
    let isInclude = false;
    let index: number | null = null;
    let hash = Object.keys(a);
    for(let i = 0;i < List.length;i++){
      if(hash[0] == List[i].hash){
        isInclude = true;
        index = i;
        break;
      }
    }
    if(isInclude){
      let thisApp: RawApp = {
        id: List[index as number].appId,
        name: List[index as number].appName,
        groups: [],
      };
      let LappConfig = json5.parse(a[hash[0]]);
      if(!LappConfig.hasOwnProperty('popup_rules')) return;
      let Lrules = LappConfig.popup_rules;
      let groupKeyCount = 1;
      let ruleKeyCount = 0;
      let thisGroup: RawAppGroup;

      Lrules.forEach((r: any) => {
        if(r == null) return;

        if(ruleKeyCount == 0){
          thisGroup = {
            key: groupKeyCount,
            name: `${List[index as number].appName}-${String(groupKeyCount)}`,
            rules: [],
          };
        }

        let thisRule: RawAppRule = {
          key: ruleKeyCount,
          matches: [],
        };

        if(r.hasOwnProperty('times')) thisRule.actionMaximum = r.times;

        if(LappConfig.hasOwnProperty('delay')) thisRule.actionDelay = LappConfig.delay;

        const thisRuleMatches = iArrayToArray(thisRule.matches as IArray<string>);

        if(r.action == 'GLOBAL_ACTION_BACK') thisRule.action = 'back';
        else{
          let isBounds = r.action.split(',');
          if(isBounds.length < 4) thisRuleMatches.push(textRuleConvert(r.action));
          else if(isBounds.length == 4 || isBounds.length == 5){
            thisRule.position = boundsRuleConvert(r.action);
            thisRuleMatches.push('[id="android:id/content"]');
          }
        }

        thisRule.matches = thisRuleMatches;

        const thisGroupRules = iArrayToArray(thisGroup.rules as IArray<RawAppRule>);

        thisGroupRules.push(thisRule);
        thisGroup.rules = thisGroupRules;
        if(LappConfig.hasOwnProperty('unite_popup_rules')){
          if(LappConfig.unite_popup_rules == true){
            if(ruleKeyCount < getJsonArrayLength(Lrules) - 1) ruleKeyCount++;
            else{
              thisApp.groups.push(thisGroup);
              groupKeyCount++;
            }
          }
        }
        else{
          thisApp.groups.push(thisGroup);
          groupKeyCount++;
        }
      });

      const thisSubApps = iArrayToArray(thisSub.apps as RawApp[]);

      thisSubApps.push(thisApp);
      thisSub.apps = thisSubApps;
    }
    else throwCount++;
  });

  await fs.writeFile(process.cwd() + '/log.txt', `共识别到应用${originLength}个，已抛弃${throwCount}个未知应用的规则`);

  await fs.writeFile(process.cwd() + '/-2.json', JSON.stringify(thisSub));
};
convert();