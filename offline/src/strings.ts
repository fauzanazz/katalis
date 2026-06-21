import type { LocalizedText } from "./data/types";

/**
 * Offline-only UI strings (trilingual), kept local to this build so we don't
 * have to thread bespoke keys through the shared Paraglide catalog + codegen.
 * Render with `t(STR.key, locale)` from data/types. For strings that already
 * exist in the shared catalog, use `m.*()` directly instead.
 */
export const STR = {
  greeting: { id: "Hai,", en: "Hi,", zh: "你好，" },
  continue: { id: "Lanjutkan", en: "Continue", zh: "继续" },

  // Profiles
  whoPlaying: { id: "Siapa yang bermain?", en: "Who's playing?", zh: "谁在玩？" },
  newExplorer: { id: "Penjelajah baru", en: "New explorer", zh: "新探险家" },
  yourName: { id: "Namamu", en: "Your name", zh: "你的名字" },
  pickAvatar: { id: "Pilih avatar", en: "Pick an avatar", zh: "选择头像" },
  pickLanguage: { id: "Pilih bahasa", en: "Pick a language", zh: "选择语言" },
  letsGo: { id: "Ayo mulai!", en: "Let's go!", zh: "出发吧！" },
  deleteProfile: { id: "Hapus profil", en: "Delete profile", zh: "删除档案" },
  deleteConfirm: {
    id: "Hapus profil ini beserta semua kemajuannya?",
    en: "Delete this profile and all its progress?",
    zh: "删除此档案及其所有进度吗？",
  },

  // Discover / Quest
  exploreTalent: { id: "Melatih", en: "Nurtures", zh: "培养" },
  startQuest: { id: "Mulai petualangan", en: "Start quest", zh: "开始冒险" },
  resumeQuest: { id: "Lanjutkan petualangan", en: "Resume quest", zh: "继续冒险" },
  day: { id: "Hari", en: "Day", zh: "第" },
  dayZh: { id: "", en: "", zh: "天" },
  markDone: { id: "Tandai selesai", en: "Mark done", zh: "标记完成" },
  done: { id: "Selesai", en: "Done", zh: "已完成" },
  steps: { id: "Langkah", en: "Steps", zh: "步骤" },
  materials: { id: "Bahan", en: "Materials", zh: "材料" },
  tips: { id: "Tips", en: "Tips", zh: "小贴士" },
  questDone: { id: "Petualangan selesai! 🎉", en: "Quest complete! 🎉", zh: "冒险完成！🎉" },
  newBadge: { id: "Lencana baru!", en: "New badge!", zh: "新徽章！" },

  // Gallery
  addWork: { id: "Tambah karya", en: "Add work", zh: "添加作品" },
  galleryEmpty: {
    id: "Belum ada karya. Foto hasil kreasimu di sini!",
    en: "No works yet. Snap a photo of your creations here!",
    zh: "还没有作品。在这里拍下你的创作吧！",
  },
  caption: { id: "Beri judul karyamu", en: "Caption your work", zh: "给作品起个标题" },
  save: { id: "Simpan", en: "Save", zh: "保存" },
  delete: { id: "Hapus", en: "Delete", zh: "删除" },

  // Mentor
  mentorOffline: {
    id: "Kit sedang offline, tapi tetap menyemangatimu!",
    en: "Kit is offline, but still cheering you on!",
    zh: "Kit 现在离线，但依然为你加油！",
  },
  askKit: { id: "Tanya Kit…", en: "Ask Kit…", zh: "问问 Kit……" },

  // Talent Scout (Explore)
  scoutTitle: { id: "Pemandu Bakat", en: "Talent Scout", zh: "天赋探子" },
  scoutSubtitle: {
    id: "Tunjukkan gambarmu pada Kit untuk menemukan bakatmu!",
    en: "Show Kit your drawing to discover your talents!",
    zh: "把你的作品给 Kit 看，发现你的天赋！",
  },
  scoutScan: { id: "Pindai gambarku", en: "Scan my drawing", zh: "扫描我的作品" },
  scoutLooking: { id: "Kit sedang melihat…", en: "Kit is looking…", zh: "Kit 正在看……" },
  scoutAgain: { id: "Pindai lagi", en: "Scan another", zh: "再扫一张" },
  scoutTalents: { id: "Bakatmu", en: "Your talents", zh: "你的天赋" },
  scoutSuggested: { id: "Petualangan untukmu", en: "Adventures for you", zh: "为你推荐的冒险" },
  scoutOffline: {
    id: "Kit perlu internet untuk melihat gambarmu.",
    en: "Kit needs internet to look at your drawing.",
    zh: "Kit 需要联网才能看你的画。",
  },
  scoutError: {
    id: "Kit kurang jelas melihatnya. Coba foto lain ya!",
    en: "Kit couldn't see it clearly. Try another photo!",
    zh: "Kit 看不太清楚，换一张照片试试吧！",
  },
  allAdventures: { id: "Semua petualangan", en: "All adventures", zh: "所有冒险" },

  // Quest — Kit's tip
  kitTip: { id: "Tips dari Kit", en: "Kit's tip", zh: "Kit 的小贴士" },
  getKitTip: { id: "Minta tips dari Kit", en: "Get a tip from Kit", zh: "向 Kit 要个小贴士" },

  // Gallery — Kit's feedback
  askKitWork: { id: "Tanya Kit", en: "Ask Kit", zh: "问问 Kit" },
  kitFeedbackTitle: { id: "Kata Kit", en: "Kit says", zh: "Kit 说" },
  fbPraise: { id: "Hebat!", en: "Wonderful!", zh: "太棒了！" },
  fbNoticed: { id: "Kit melihat", en: "Kit noticed", zh: "Kit 注意到" },
  fbTryNext: { id: "Coba selanjutnya", en: "Try next", zh: "下次试试" },
  aiOffline: {
    id: "Sambungkan ke internet untuk mendengar dari Kit.",
    en: "Connect to the internet to hear from Kit.",
    zh: "联网后就能听到 Kit 的话啦。",
  },
  aiError: {
    id: "Kit sedang sibuk. Coba lagi ya!",
    en: "Kit is busy right now. Try again!",
    zh: "Kit 现在有点忙，再试一次吧！",
  },
  close: { id: "Tutup", en: "Close", zh: "关闭" },
} satisfies Record<string, LocalizedText>;
