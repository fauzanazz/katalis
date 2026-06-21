import type { Quest } from "./types";

/**
 * Bundled, read-only quest catalog. Authored content (no AI generation needed
 * offline). Each quest is a 7-day adventure that nurtures one talent. Add quests
 * by following the shape of the two below; ids and mission ids must stay unique.
 */
export const QUESTS: Quest[] = [
  {
    id: "robot",
    theme: "engineering",
    emoji: "🤖",
    image: "/story-prompts/city-builders.webp",
    title: { id: "Pembuat Robot", en: "Robot Maker", zh: "机器人制造师" },
    dream: {
      id: "Aku ingin membuat robot yang menolong orang.",
      en: "I want to build robots that help people.",
      zh: "我想制造能帮助别人的机器人。",
    },
    summary: {
      id: "Rancang dan bangun robot dari barang di sekitarmu.",
      en: "Design and build a robot from things around you.",
      zh: "用身边的材料设计并制作一个机器人。",
    },
    talent: { id: "Teknik & Rekayasa", en: "Engineering", zh: "工程" },
    missions: [
      {
        id: "robot-d1",
        day: 1,
        title: { id: "Gambar robot impianmu", en: "Draw your dream robot", zh: "画出你梦想的机器人" },
        instructions: [
          { id: "Bayangkan robot yang menolong di rumah.", en: "Imagine a robot that helps at home.", zh: "想象一个能在家帮忙的机器人。" },
          { id: "Gambar bentuk dan bagiannya.", en: "Draw its shape and parts.", zh: "画出它的形状和零件。" },
        ],
        materials: [{ id: "Kertas & pensil", en: "Paper & pencil", zh: "纸和铅笔" }],
        tips: [{ id: "Tidak ada gambar yang salah!", en: "There are no wrong drawings!", zh: "没有画错这回事！" }],
      },
      {
        id: "robot-d2",
        day: 2,
        title: { id: "Kumpulkan barang bekas", en: "Collect recyclables", zh: "收集可回收材料" },
        instructions: [
          { id: "Cari kardus, tutup botol, dan gulungan tisu.", en: "Find boxes, bottle caps, and tubes.", zh: "找纸箱、瓶盖和纸筒。" },
        ],
        materials: [{ id: "Barang bekas aman", en: "Safe recyclables", zh: "安全的回收物" }],
        tips: [{ id: "Minta izin orang tua dulu.", en: "Ask a grown-up first.", zh: "先征得大人同意。" }],
      },
      {
        id: "robot-d3",
        day: 3,
        title: { id: "Bangun badan robot", en: "Build the robot body", zh: "搭建机器人身体" },
        instructions: [
          { id: "Tempelkan kardus jadi badan robot.", en: "Tape boxes into a robot body.", zh: "把纸箱粘成机器人身体。" },
        ],
        materials: [{ id: "Lem/selotip", en: "Glue or tape", zh: "胶水或胶带" }],
        tips: [{ id: "Buat sambungan yang kuat.", en: "Make strong joints.", zh: "让连接更牢固。" }],
      },
      {
        id: "robot-d4",
        day: 4,
        title: { id: "Beri wajah & tangan", en: "Add a face & arms", zh: "添加脸和手臂" },
        instructions: [
          { id: "Tambahkan mata, mulut, dan tangan.", en: "Add eyes, a mouth, and arms.", zh: "添加眼睛、嘴巴和手臂。" },
        ],
        materials: [{ id: "Tutup botol, sedotan", en: "Caps, straws", zh: "瓶盖、吸管" }],
        tips: [{ id: "Beri robotmu ekspresi!", en: "Give your robot an expression!", zh: "给机器人一个表情吧！" }],
      },
      {
        id: "robot-d5",
        day: 5,
        title: { id: "Hias dengan warna", en: "Decorate with color", zh: "涂上颜色" },
        instructions: [
          { id: "Warnai robotmu sesukamu.", en: "Color your robot any way you like.", zh: "随心给机器人上色。" },
        ],
        materials: [{ id: "Krayon/cat", en: "Crayons or paint", zh: "蜡笔或颜料" }],
        tips: [{ id: "Warna cerah lebih ceria!", en: "Bright colors are cheerful!", zh: "明亮的颜色更欢快！" }],
      },
      {
        id: "robot-d6",
        day: 6,
        title: { id: "Beri nama & tugas", en: "Name it & give a job", zh: "起名并赋予任务" },
        instructions: [
          { id: "Beri nama robot dan satu tugas menolong.", en: "Name your robot and give it one helpful job.", zh: "给机器人起名，并安排一个帮忙的任务。" },
        ],
        materials: [],
        tips: [{ id: "Contoh: robot perapi mainan.", en: "E.g. a toy-tidying robot.", zh: "例如：整理玩具的机器人。" }],
      },
      {
        id: "robot-d7",
        day: 7,
        title: { id: "Pamerkan robotmu", en: "Show off your robot", zh: "展示你的机器人" },
        instructions: [
          { id: "Ceritakan robotmu ke keluarga & foto.", en: "Tell your family about it & take a photo.", zh: "向家人介绍它并拍张照片。" },
        ],
        materials: [],
        tips: [{ id: "Simpan fotonya di Galeri!", en: "Save the photo in the Gallery!", zh: "把照片存到画廊里！" }],
      },
    ],
  },
  {
    id: "storyteller",
    theme: "narrative",
    emoji: "📖",
    image: "/story-prompts/magical-garden.webp",
    title: { id: "Pendongeng", en: "Storyteller", zh: "故事大王" },
    dream: {
      id: "Aku ingin menulis cerita yang menginspirasi.",
      en: "I want to write stories that inspire.",
      zh: "我想写出鼓舞人心的故事。",
    },
    summary: {
      id: "Ciptakan cerita petualanganmu sendiri, sedikit demi sedikit.",
      en: "Create your own adventure story, step by step.",
      zh: "一步步创作属于你自己的冒险故事。",
    },
    talent: { id: "Bercerita", en: "Storytelling", zh: "叙事" },
    missions: [
      {
        id: "story-d1",
        day: 1,
        title: { id: "Pilih pahlawanmu", en: "Pick your hero", zh: "选择你的主角" },
        instructions: [
          { id: "Bayangkan tokoh utama ceritamu.", en: "Imagine your story's main character.", zh: "想象故事的主角。" },
          { id: "Gambar atau tuliskan namanya.", en: "Draw or write their name.", zh: "画出或写下它的名字。" },
        ],
        materials: [{ id: "Kertas & pensil", en: "Paper & pencil", zh: "纸和铅笔" }],
        tips: [{ id: "Pahlawan bisa hewan atau benda!", en: "A hero can be an animal or object!", zh: "主角可以是动物或物品！" }],
      },
      {
        id: "story-d2",
        day: 2,
        title: { id: "Tentukan tempat", en: "Choose the setting", zh: "确定场景" },
        instructions: [
          { id: "Di mana petualangan terjadi?", en: "Where does the adventure happen?", zh: "冒险发生在哪里？" },
        ],
        materials: [],
        tips: [{ id: "Hutan? Luar angkasa? Bebas!", en: "Forest? Space? Your call!", zh: "森林？太空？你说了算！" }],
      },
      {
        id: "story-d3",
        day: 3,
        title: { id: "Munculkan masalah", en: "Add a problem", zh: "加入一个难题" },
        instructions: [
          { id: "Beri pahlawanmu satu masalah seru.", en: "Give your hero one exciting problem.", zh: "给主角一个精彩的难题。" },
        ],
        materials: [],
        tips: [{ id: "Masalah membuat cerita seru.", en: "Problems make stories exciting.", zh: "难题让故事更精彩。" }],
      },
      {
        id: "story-d4",
        day: 4,
        title: { id: "Cari teman penolong", en: "Find a helper friend", zh: "找一个帮手朋友" },
        instructions: [
          { id: "Tambahkan teman yang membantu pahlawanmu.", en: "Add a friend who helps your hero.", zh: "添加一个帮助主角的朋友。" },
        ],
        materials: [],
        tips: [{ id: "Dua kepala lebih baik dari satu!", en: "Two heads are better than one!", zh: "三个臭皮匠胜过诸葛亮！" }],
      },
      {
        id: "story-d5",
        day: 5,
        title: { id: "Saat paling menegangkan", en: "The big moment", zh: "最紧张的时刻" },
        instructions: [
          { id: "Ceritakan bagaimana masalah dihadapi.", en: "Tell how the problem is faced.", zh: "讲述如何面对难题。" },
        ],
        materials: [],
        tips: [{ id: "Buat pembaca penasaran!", en: "Keep readers curious!", zh: "让读者好奇！" }],
      },
      {
        id: "story-d6",
        day: 6,
        title: { id: "Akhir yang bahagia", en: "A happy ending", zh: "圆满的结局" },
        instructions: [
          { id: "Selesaikan cerita dengan akhir favoritmu.", en: "Finish with your favorite ending.", zh: "用你最喜欢的结局收尾。" },
        ],
        materials: [],
        tips: [{ id: "Akhir bisa lucu atau mengharukan.", en: "Endings can be funny or sweet.", zh: "结局可以搞笑或感人。" }],
      },
      {
        id: "story-d7",
        day: 7,
        title: { id: "Bacakan ceritamu", en: "Read your story aloud", zh: "朗读你的故事" },
        instructions: [
          { id: "Bacakan untuk keluarga & foto halamannya.", en: "Read it to family & photograph a page.", zh: "读给家人听，并拍下一页。" },
        ],
        materials: [],
        tips: [{ id: "Simpan di Galeri sebagai kenangan!", en: "Save it in the Gallery as a keepsake!", zh: "存到画廊留作纪念！" }],
      },
    ],
  },
  {
    id: "painter",
    theme: "art",
    emoji: "🎨",
    image: "/story-prompts/rainy-day.webp",
    title: { id: "Pelukis Cilik", en: "Little Painter", zh: "小画家" },
    dream: {
      id: "Aku ingin mengisi dunia dengan warna dan keindahan melalui lukisanku.",
      en: "I want to fill the world with color and beauty through my paintings.",
      zh: "我想用画笔让世界充满色彩和美丽。",
    },
    summary: {
      id: "Belajar melukis dan ungkapkan perasaanmu lewat warna.",
      en: "Learn to paint and express your feelings through color.",
      zh: "学习绘画，用颜色表达你的心情。",
    },
    talent: { id: "Seni Visual", en: "Visual Art", zh: "视觉艺术" },
    missions: [
      {
        id: "painter-d1",
        day: 1,
        title: { id: "Warna favoritmu", en: "Your favorite color", zh: "你最喜欢的颜色" },
        instructions: [
          { id: "Pilih satu warna yang paling kamu suka.", en: "Pick one color you love the most.", zh: "选一个你最喜欢的颜色。" },
          { id: "Gambar bentuk apa pun dengan warna itu saja.", en: "Draw any shapes using only that color.", zh: "用那个颜色画出任意形状。" },
        ],
        materials: [{ id: "Kertas & krayon/cat", en: "Paper & crayons or paint", zh: "纸和蜡笔或颜料" }],
        tips: [{ id: "Warna kesukaanmu mencerminkan dirimu!", en: "Your favorite color shows who you are!", zh: "你最爱的颜色代表着你！" }],
      },
      {
        id: "painter-d2",
        day: 2,
        title: { id: "Campur dua warna", en: "Mix two colors", zh: "混合两种颜色" },
        instructions: [
          { id: "Campur merah dan kuning — apa yang terjadi?", en: "Mix red and yellow — what happens?", zh: "混合红色和黄色——会发生什么？" },
          { id: "Coba campur dua warna lain dan cat hasilnya.", en: "Try mixing two other colors and paint the result.", zh: "再试着混合另外两种颜色，然后涂出来。" },
        ],
        materials: [{ id: "Cat warna & palet/piring kecil", en: "Paint & a palette or small plate", zh: "颜料和调色盘或小碟子" }],
        tips: [{ id: "Mencampur warna itu seperti sihir!", en: "Mixing colors is like magic!", zh: "混色就像变魔法！" }],
      },
      {
        id: "painter-d3",
        day: 3,
        title: { id: "Lukis benda di sekitarmu", en: "Paint something nearby", zh: "画身边的东西" },
        instructions: [
          { id: "Pilih satu benda di rumah yang menarik.", en: "Pick one interesting object at home.", zh: "选一件家里有趣的东西。" },
          { id: "Amati dan lukis dengan hati-hati.", en: "Look closely and paint it carefully.", zh: "仔细观察，认真地画出来。" },
        ],
        materials: [{ id: "Kertas, cat atau krayon", en: "Paper, paint or crayons", zh: "纸、颜料或蜡笔" }],
        tips: [{ id: "Lihatlah barang biasa dengan mata seniman!", en: "See everyday things through an artist's eyes!", zh: "用艺术家的眼光看普通物品！" }],
      },
      {
        id: "painter-d4",
        day: 4,
        title: { id: "Lukis perasaanmu", en: "Paint your feelings", zh: "画出你的心情" },
        instructions: [
          { id: "Bagaimana perasaanmu hari ini? Pilih warna yang cocok.", en: "How do you feel today? Choose a matching color.", zh: "你今天心情怎么样？选一个合适的颜色。" },
          { id: "Lukis bentuk atau coretan yang mewakili perasaan itu.", en: "Paint shapes or strokes that show that feeling.", zh: "画出能表达那种心情的形状或笔触。" },
        ],
        materials: [{ id: "Kertas besar, cat", en: "Large paper, paint", zh: "大纸、颜料" }],
        tips: [{ id: "Tidak perlu rapi — ekspresi itu indah!", en: "It doesn't need to be neat — expression is beautiful!", zh: "不需要整齐——表达本身就是美！" }],
      },
      {
        id: "painter-d5",
        day: 5,
        title: { id: "Lukisan alam", en: "Paint nature", zh: "画自然" },
        instructions: [
          { id: "Lihat ke luar jendela atau pergi ke taman sebentar.", en: "Look out a window or step outside briefly.", zh: "往窗外看看，或者去外面走一走。" },
          { id: "Lukis apa yang kamu lihat: pohon, langit, atau bunga.", en: "Paint what you see: trees, sky, or flowers.", zh: "画出你看到的：树、天空或花。" },
        ],
        materials: [{ id: "Kertas, cat atau pensil warna", en: "Paper, paint or colored pencils", zh: "纸、颜料或彩铅" }],
        tips: [{ id: "Alam adalah kanvas terbesar di dunia!", en: "Nature is the biggest canvas in the world!", zh: "大自然是世界上最大的画布！" }],
      },
      {
        id: "painter-d6",
        day: 6,
        title: { id: "Buat karya terbaikmu", en: "Create your best work", zh: "创作你的最佳作品" },
        instructions: [
          { id: "Pilih teknik favoritmu dari minggu ini.", en: "Pick your favorite technique from this week.", zh: "选本周你最喜欢的绘画方式。" },
          { id: "Buat lukisan yang ingin kamu simpan selamanya.", en: "Create a painting you want to keep forever.", zh: "画一幅你想永远珍藏的画。" },
        ],
        materials: [{ id: "Kertas terbaik yang ada", en: "The best paper you have", zh: "你最好的纸" }],
        tips: [{ id: "Luangkan waktu dan nikmati prosesnya.", en: "Take your time and enjoy every stroke.", zh: "慢慢来，享受每一笔。" }],
      },
      {
        id: "painter-d7",
        day: 7,
        title: { id: "Pameran seni pribadimu", en: "Your personal art show", zh: "你的个人画展" },
        instructions: [
          { id: "Tempel semua lukisanmu di dinding atau meja.", en: "Display all your paintings on a wall or table.", zh: "把所有画展示在墙上或桌子上。" },
          { id: "Ajak keluarga melihat dan foto karya terbaikmu.", en: "Invite family to see them and photograph your best piece.", zh: "邀请家人欣赏，并拍下你的最佳作品。" },
        ],
        materials: [],
        tips: [{ id: "Simpan foto di Galeri — kamu adalah seniman!", en: "Save the photo in the Gallery — you are an artist!", zh: "存到画廊——你是真正的艺术家！" }],
      },
    ],
  },
  {
    id: "gardener",
    theme: "nature",
    emoji: "🌱",
    image: "/story-prompts/forest-adventure.webp",
    title: { id: "Pekebun Muda", en: "Young Gardener", zh: "小园丁" },
    dream: {
      id: "Aku ingin menumbuhkan tanaman dan menjaga alam.",
      en: "I want to grow plants and take care of nature.",
      zh: "我想种植植物，守护大自然。",
    },
    summary: {
      id: "Tanam benihmu sendiri dan lihat keajaiban alam terjadi.",
      en: "Plant your own seeds and watch nature's magic unfold.",
      zh: "种下自己的种子，见证大自然的奇迹。",
    },
    talent: { id: "Berkebun & Alam", en: "Gardening & Nature", zh: "园艺与自然" },
    missions: [
      {
        id: "gardener-d1",
        day: 1,
        title: { id: "Apa yang dibutuhkan tanaman?", en: "What do plants need?", zh: "植物需要什么？" },
        instructions: [
          { id: "Amati tanaman di rumah atau luar. Apa yang ada di sekitarnya?", en: "Look at a plant at home or outside. What is around it?", zh: "观察家里或外面的植物，它周围有什么？" },
          { id: "Gambar tanaman itu dan tulis: air, cahaya, tanah.", en: "Draw the plant and write: water, light, soil.", zh: "画出那棵植物，并写上：水、光照、土壤。" },
        ],
        materials: [{ id: "Kertas & pensil", en: "Paper & pencil", zh: "纸和铅笔" }],
        tips: [{ id: "Tanaman adalah makhluk hidup seperti kita!", en: "Plants are living things just like us!", zh: "植物和我们一样是有生命的！" }],
      },
      {
        id: "gardener-d2",
        day: 2,
        title: { id: "Siapkan potmu", en: "Prepare your pot", zh: "准备你的花盆" },
        instructions: [
          { id: "Cari pot atau gelas bekas yang bersih.", en: "Find a clean pot or used cup.", zh: "找一个干净的花盆或旧杯子。" },
          { id: "Isi dengan tanah hingga tiga perempat penuh.", en: "Fill it three-quarters full with soil.", zh: "装入四分之三的土壤。" },
        ],
        materials: [{ id: "Pot/gelas bekas, tanah", en: "Pot or cup, soil", zh: "花盆或旧杯子、土壤" }],
        tips: [{ id: "Pastikan ada lubang kecil di bawah agar air bisa keluar.", en: "Make sure there's a small hole at the bottom for water.", zh: "确保底部有小孔让水流出。" }],
      },
      {
        id: "gardener-d3",
        day: 3,
        title: { id: "Tanam benihmu", en: "Plant your seed", zh: "种下你的种子" },
        instructions: [
          { id: "Buat lubang kecil di tanah dengan jarimu.", en: "Make a small hole in the soil with your finger.", zh: "用手指在土里挖一个小洞。" },
          { id: "Masukkan benih, tutup, lalu siram pelan-pelan.", en: "Put the seed in, cover it, then water gently.", zh: "放入种子，盖上土，然后轻轻浇水。" },
        ],
        materials: [{ id: "Benih (kacang, bayam, atau bunga)", en: "Seeds (bean, spinach, or flower)", zh: "种子（豆子、菠菜或花种）" }],
        tips: [{ id: "Tanam dengan penuh kasih sayang!", en: "Plant it with love!", zh: "带着爱心种下它！" }],
      },
      {
        id: "gardener-d4",
        day: 4,
        title: { id: "Rawat dan amati", en: "Care and observe", zh: "照料与观察" },
        instructions: [
          { id: "Siram tanamanmu sedikit — tanah jangan sampai kering.", en: "Water your plant a little — soil shouldn't dry out.", zh: "给植物浇一点水——土壤不能干透。" },
          { id: "Taruh di tempat yang terkena cahaya matahari.", en: "Place it where sunlight can reach.", zh: "把它放在能照到阳光的地方。" },
        ],
        materials: [],
        tips: [{ id: "Setiap hari cek — perubahan kecil itu penting!", en: "Check every day — small changes matter!", zh: "每天查看——微小的变化很重要！" }],
      },
      {
        id: "gardener-d5",
        day: 5,
        title: { id: "Buat buku harian tanaman", en: "Keep a plant diary", zh: "写植物日记" },
        instructions: [
          { id: "Gambar bagaimana tanamanmu sekarang.", en: "Draw what your plant looks like now.", zh: "画出你的植物现在的样子。" },
          { id: "Tuliskan warna, ukuran, dan apa yang kamu rasakan.", en: "Write its color, size, and how you feel.", zh: "写下它的颜色、大小，以及你的感受。" },
        ],
        materials: [{ id: "Buku kecil atau kertas", en: "Small notebook or paper", zh: "小本子或纸" }],
        tips: [{ id: "Ilmuwan sejati mencatat pengamatan mereka!", en: "Real scientists record their observations!", zh: "真正的科学家会记录他们的观察！" }],
      },
      {
        id: "gardener-d6",
        day: 6,
        title: { id: "Beri nama tanamanmu", en: "Name your plant", zh: "给植物起名字" },
        instructions: [
          { id: "Buat label kecil dari kertas dan tempel di pot.", en: "Make a small paper label and stick it on the pot.", zh: "用纸做一个小标签贴在花盆上。" },
          { id: "Tulis nama dan tanggal tanamnya.", en: "Write its name and the date you planted it.", zh: "写上名字和种植日期。" },
        ],
        materials: [{ id: "Kertas, pensil, selotip", en: "Paper, pencil, tape", zh: "纸、铅笔、胶带" }],
        tips: [{ id: "Namamu sendiri bisa jadi nama tanamanmu!", en: "Your own name could be your plant's name!", zh: "你自己的名字也可以是植物的名字！" }],
      },
      {
        id: "gardener-d7",
        day: 7,
        title: { id: "Bagikan keajaibanmu", en: "Share your miracle", zh: "分享你的奇迹" },
        instructions: [
          { id: "Foto tanamanmu di sebelah buku harianmu.", en: "Photograph your plant next to your diary.", zh: "把植物和日记一起拍照。" },
          { id: "Ceritakan perjalanannya kepada keluarga.", en: "Tell your family about its journey.", zh: "向家人讲述它的成长故事。" },
        ],
        materials: [],
        tips: [{ id: "Simpan foto di Galeri — kamu sudah menanam kehidupan!", en: "Save the photo in the Gallery — you grew life!", zh: "存到画廊——你种出了生命！" }],
      },
    ],
  },
  {
    id: "musician",
    theme: "music",
    emoji: "🎵",
    image: "/story-prompts/mountain-explorer.webp",
    title: { id: "Musisi Muda", en: "Young Musician", zh: "小音乐家" },
    dream: {
      id: "Aku ingin membuat musik yang membuat orang tersenyum.",
      en: "I want to make music that makes people smile.",
      zh: "我想创作能让人微笑的音乐。",
    },
    summary: {
      id: "Buat alat musik sendiri dan ciptakan lagumu pertama.",
      en: "Make your own instrument and compose your first song.",
      zh: "自制乐器，创作你的第一首歌。",
    },
    talent: { id: "Musik", en: "Music", zh: "音乐" },
    missions: [
      {
        id: "musician-d1",
        day: 1,
        title: { id: "Dengarkan iramanya", en: "Listen for the beat", zh: "感受节奏" },
        instructions: [
          { id: "Putar lagu favoritmu dan dengarkan baik-baik.", en: "Play your favorite song and listen carefully.", zh: "播放你最喜欢的歌，仔细聆听。" },
          { id: "Tepuk tangan mengikuti iramanya.", en: "Clap your hands to the beat.", zh: "随着节奏拍手。" },
        ],
        materials: [],
        tips: [{ id: "Musik ada di mana-mana — bahkan suara hujan!", en: "Music is everywhere — even the sound of rain!", zh: "音乐无处不在——就连雨声也是！" }],
      },
      {
        id: "musician-d2",
        day: 2,
        title: { id: "Buat alat musikmu", en: "Make your instrument", zh: "制作你的乐器" },
        instructions: [
          { id: "Isi botol atau kaleng dengan beras atau batu kecil.", en: "Fill a bottle or can with rice or small pebbles.", zh: "往瓶子或罐子里装大米或小石子。" },
          { id: "Tutup rapat dan kocok — itulah marakasmu!", en: "Seal it tight and shake — that's your maraca!", zh: "盖紧后摇一摇——这就是你的沙锤！" },
        ],
        materials: [{ id: "Botol/kaleng bekas, beras atau kerikil", en: "Used bottle or can, rice or pebbles", zh: "旧瓶子或罐子、大米或小石子" }],
        tips: [{ id: "Isi berbeda menghasilkan suara berbeda — coba yuk!", en: "Different fillings make different sounds — try it!", zh: "不同的填充物会发出不同的声音——试试看！" }],
      },
      {
        id: "musician-d3",
        day: 3,
        title: { id: "Temukan tiga bunyi", en: "Find three sounds", zh: "发现三种声音" },
        instructions: [
          { id: "Jelajahi rumah: ketuk meja, pukul buku, tepuk lantai.", en: "Explore your home: tap a table, hit a book, pat the floor.", zh: "探索家里：敲桌子、拍书本、拍地板。" },
          { id: "Pilih tiga bunyi favoritmu dan mainkan berulang.", en: "Pick your three favorite sounds and repeat them.", zh: "选出三个你最喜欢的声音，反复演奏。" },
        ],
        materials: [],
        tips: [{ id: "Benda biasa bisa jadi instrumen luar biasa!", en: "Ordinary objects can become extraordinary instruments!", zh: "普通物品也能变成奇妙的乐器！" }],
      },
      {
        id: "musician-d4",
        day: 4,
        title: { id: "Ciptakan melodi pendek", en: "Create a short melody", zh: "创作一段短旋律" },
        instructions: [
          { id: "Gunakan suaramu — bersenandunglah 5 nada naik lalu turun.", en: "Use your voice — hum 5 notes going up then down.", zh: "用你的嗓音——哼出5个音，先上升再下降。" },
          { id: "Ulangi melodi itu sampai kamu menghafalnya.", en: "Repeat the melody until you remember it.", zh: "反复哼唱，直到你记住这段旋律。" },
        ],
        materials: [],
        tips: [{ id: "Suaramu adalah alat musik terbaik!", en: "Your voice is the best instrument!", zh: "你的嗓音是最好的乐器！" }],
      },
      {
        id: "musician-d5",
        day: 5,
        title: { id: "Tambahkan kata-kata", en: "Add some words", zh: "加上歌词" },
        instructions: [
          { id: "Nyanyikan melodi yang sudah kamu buat dengan kata-kata.", en: "Sing your melody with words.", zh: "用歌词演唱你编的旋律。" },
          { id: "Tulis lirik sederhana tentang hal favoritmu.", en: "Write simple lyrics about your favorite things.", zh: "写一段关于你最爱事物的简单歌词。" },
        ],
        materials: [{ id: "Kertas & pensil", en: "Paper & pencil", zh: "纸和铅笔" }],
        tips: [{ id: "Lirik tidak perlu sempurna — yang penting dari hati!", en: "Lyrics don't need to be perfect — just from the heart!", zh: "歌词不必完美——重要的是发自内心！" }],
      },
      {
        id: "musician-d6",
        day: 6,
        title: { id: "Latihan lagumu", en: "Practice your song", zh: "练习你的歌" },
        instructions: [
          { id: "Nyanyikan lagumu dari awal sampai akhir tiga kali.", en: "Sing your song from start to finish three times.", zh: "把你的歌从头到尾唱三遍。" },
          { id: "Tambahkan iringan marakasmu.", en: "Add your maraca as accompaniment.", zh: "用你的沙锤伴奏。" },
        ],
        materials: [{ id: "Marakas buatanmu", en: "Your homemade maraca", zh: "你自制的沙锤" }],
        tips: [{ id: "Semakin banyak latihan, semakin percaya diri!", en: "The more you practice, the more confident you'll be!", zh: "练得越多，就越自信！" }],
      },
      {
        id: "musician-d7",
        day: 7,
        title: { id: "Pentas perdanamu", en: "Your first concert", zh: "你的首场演出" },
        instructions: [
          { id: "Ajak keluarga duduk dan nyanyikan lagumu untuk mereka.", en: "Invite family to sit down and sing your song for them.", zh: "邀请家人坐下来，为他们演唱你的歌。" },
          { id: "Minta mereka merekam atau foto penampilanmu.", en: "Ask them to record or photograph your performance.", zh: "请他们录下或拍下你的演出。" },
        ],
        materials: [],
        tips: [{ id: "Simpan rekaman di Galeri — kamu adalah musisi!", en: "Save the recording in the Gallery — you are a musician!", zh: "把录音存到画廊——你是真正的音乐家！" }],
      },
    ],
  },
];

/** Catalog lookup by quest id — stable accessor used across every screen. */
export function getQuest(id: string): Quest | undefined {
  return QUESTS.find((quest) => quest.id === id);
}
