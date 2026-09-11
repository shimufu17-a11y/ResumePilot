import type { SensitiveLevel } from "./model";

export interface FieldDefinition {
  path: string;
  label: string;
  aliases: string[];
  sensitiveLevel: SensitiveLevel;
  negativeAliases?: string[];
}

export const FIELD_DICTIONARY: FieldDefinition[] = [
  {
    path: "commonProfile.personal.fullNameZh",
    label: "中文姓名",
    aliases: ["姓名", "中文名", "name", "full name", "candidate name"],
    negativeAliases: ["紧急联系人", "联系人姓名", "推荐人"],
    sensitiveLevel: "normal"
  },
  {
    path: "commonProfile.personal.fullNameEn",
    label: "英文姓名",
    aliases: ["英文名", "英文姓名", "english name", "name in english"],
    sensitiveLevel: "normal"
  },
  {
    path: "commonProfile.personal.phone",
    label: "手机号",
    aliases: ["手机号", "手机号码", "联系电话", "电话", "mobile", "phone", "telephone"],
    negativeAliases: ["紧急联系人", "家庭电话", "公司电话"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.email",
    label: "邮箱",
    aliases: ["邮箱", "电子邮箱", "邮件", "email", "e-mail"],
    negativeAliases: ["推荐人", "紧急联系人"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.gender",
    label: "性别",
    aliases: ["性别", "gender", "sex"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.birthDate",
    label: "出生日期",
    aliases: ["出生日期", "出生年月", "生日", "date of birth", "birth date", "birthday"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.nationality",
    label: "国籍",
    aliases: ["国籍", "nationality", "citizenship"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.ethnicity",
    label: "民族",
    aliases: ["民族", "ethnicity", "ethnic group"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.politicalStatus",
    label: "政治面貌",
    aliases: ["政治面貌", "政治身份", "political status"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.nativePlace",
    label: "籍贯",
    aliases: ["籍贯", "native place"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.hometown",
    label: "生源地",
    aliases: ["生源地", "生源所在地", "place of origin", "hometown"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.currentCity",
    label: "现居地",
    aliases: ["现居地", "当前城市", "现居城市", "current city", "current location"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.hukouLocation",
    label: "户籍所在地",
    aliases: ["户籍", "户口", "户籍所在地", "hukou", "registered residence"],
    sensitiveLevel: "high"
  },
  {
    path: "commonProfile.personal.healthStatus",
    label: "健康状况",
    aliases: ["健康状况", "健康状态", "health condition", "health status"],
    sensitiveLevel: "high"
  },
  {
    path: "commonProfile.personal.idNumber",
    label: "身份证号",
    aliases: [
      "身份证",
      "身份证号",
      "证件号码",
      "证件号",
      "id number",
      "identity number",
      "national id"
    ],
    sensitiveLevel: "high"
  },
  {
    path: "commonProfile.personal.address",
    label: "详细地址",
    aliases: ["详细地址", "家庭住址", "通讯地址", "address", "mailing address", "home address"],
    sensitiveLevel: "high"
  },
  {
    path: "commonProfile.personal.postalCode",
    label: "邮政编码",
    aliases: ["邮编", "邮政编码", "postal code", "zip code"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.wechat",
    label: "微信",
    aliases: ["微信", "微信号", "wechat", "weixin"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "commonProfile.personal.website",
    label: "个人主页",
    aliases: ["个人主页", "个人网站", "github", "portfolio", "personal website", "homepage"],
    sensitiveLevel: "normal"
  },
  {
    path: "commonProfile.education.0.school",
    label: "学校",
    aliases: ["学校", "毕业院校", "就读院校", "大学", "school", "university", "institution"],
    sensitiveLevel: "normal"
  },
  {
    path: "commonProfile.education.0.major",
    label: "专业",
    aliases: ["专业", "专业名称", "major", "field of study", "discipline"],
    sensitiveLevel: "normal"
  },
  {
    path: "commonProfile.education.0.degree",
    label: "学历/学位",
    aliases: ["学历", "学位", "最高学历", "degree", "education level", "qualification"],
    sensitiveLevel: "normal"
  },
  {
    path: "commonProfile.education.0.startDate",
    label: "入学时间",
    aliases: ["入学时间", "教育开始时间", "入学日期", "education start date", "start date"],
    sensitiveLevel: "normal"
  },
  {
    path: "commonProfile.education.0.endDate",
    label: "毕业时间",
    aliases: [
      "毕业时间",
      "预计毕业时间",
      "毕业日期",
      "graduation date",
      "education end date",
      "end date"
    ],
    sensitiveLevel: "normal"
  },
  {
    path: "commonProfile.education.0.gpa",
    label: "GPA",
    aliases: ["gpa", "绩点", "平均绩点", "grade point average"],
    sensitiveLevel: "normal"
  },
  {
    path: "commonProfile.education.0.rank",
    label: "成绩排名",
    aliases: ["成绩排名", "专业排名", "班级排名", "rank", "academic rank"],
    sensitiveLevel: "normal"
  },
  {
    path: "jobProfile.desiredLocations",
    label: "期望工作地点",
    aliases: ["期望工作地点", "意向城市", "工作地点", "preferred location", "desired location"],
    sensitiveLevel: "normal"
  },
  {
    path: "jobProfile.expectedSalary",
    label: "期望薪资",
    aliases: ["期望薪资", "薪资期望", "期望年薪", "expected salary", "salary expectation"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "jobProfile.availableDate",
    label: "到岗时间",
    aliases: ["到岗时间", "可入职时间", "预计到岗", "available date", "start availability"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "jobProfile.willingToTravel",
    label: "是否接受出差",
    aliases: ["接受出差", "是否出差", "willing to travel", "business travel"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "jobProfile.willingToRelocate",
    label: "是否接受异地",
    aliases: ["接受异地", "异地工作", "工作调动", "relocate", "relocation"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "jobProfile.acceptAdjustment",
    label: "是否接受调剂",
    aliases: ["接受调剂", "是否调剂", "岗位调剂", "position adjustment"],
    sensitiveLevel: "sensitive"
  },
  {
    path: "jobProfile.selfEvaluation",
    label: "自我评价",
    aliases: [
      "自我评价",
      "个人评价",
      "自我介绍",
      "self evaluation",
      "about yourself",
      "personal statement"
    ],
    sensitiveLevel: "normal"
  },
  {
    path: "jobProfile.motivation",
    label: "求职动机",
    aliases: ["求职动机", "申请原因", "为什么选择", "motivation", "why apply", "why do you want"],
    sensitiveLevel: "normal"
  },
  {
    path: "jobProfile.strengths",
    label: "个人优势",
    aliases: ["个人优势", "优点", "优势", "strengths", "your strength"],
    sensitiveLevel: "normal"
  },
  {
    path: "jobProfile.weaknesses",
    label: "个人不足",
    aliases: ["个人不足", "缺点", "不足", "weaknesses", "your weakness"],
    sensitiveLevel: "normal"
  },
  {
    path: "jobProfile.skillSummary",
    label: "技能概述",
    aliases: ["技能概述", "专业技能", "技能特长", "skills", "technical skills", "expertise"],
    sensitiveLevel: "normal"
  }
];
