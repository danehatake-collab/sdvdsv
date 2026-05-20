/* =========================================================================
   LEXA — основной JS приложения
   
   Архитектура:
   1. STATE — единственный источник правды (single source of truth)
   2. STORAGE — постоянное хранение через window.storage (сохраняется между сессиями)
   3. FSRS — алгоритм повторений (упрощённая версия, оптимизированная под мобильное использование)
   4. RENDER — функции отрисовки экранов, перерисовываем при изменении состояния
   5. ACTIONS — пользовательские действия меняют STATE → triggerRender → saveState
   ========================================================================= */

(function () {
  'use strict';

  // =======================================================================
  // КОНСТАНТЫ
  // =======================================================================
  
  const STORAGE_KEY = 'lexa_state_v1';
  const SESSION_GOAL = 20;          // Целевое количество слов в день
  const NEW_WORDS_PER_DAY = 8;      // Сколько новых слов вводить в день

  // Самые частые бытовые фразы: короткие, живые, пригодные для разговора.
  // Формат упражнения: пользователь собирает английскую фразу из слов.
  function phrase(id, en, ru, tip, category, distractors = []) {
    return { id, en, ru, tip, category, answer: en.split(' '), distractors };
  }

  const PHRASES = [
    phrase(1, "How are you?", "Как дела?", "Самый частый старт разговора. Отвечай: I'm good, thanks.", "Приветствие", ["what", "do"]),
    phrase(2, "I'm good, thanks.", "У меня всё хорошо, спасибо.", "Естественный короткий ответ на How are you?", "Приветствие", ["you", "very"]),
    phrase(3, "Nice to meet you.", "Приятно познакомиться.", "Говори при первом знакомстве.", "Приветствие", ["see", "again"]),
    phrase(4, "What's your name?", "Как тебя зовут?", "Бытовой вопрос при знакомстве.", "Приветствие", ["where", "my"]),
    phrase(5, "My name is Danil.", "Меня зовут Данил.", "Шаблон: My name is + имя.", "Приветствие", ["your", "are"]),
    phrase(6, "Where are you from?", "Откуда ты?", "Спрашивает страну или город.", "Приветствие", ["what", "live"]),
    phrase(7, "I'm from Russia.", "Я из России.", "Шаблон: I'm from + место.", "Приветствие", ["in", "at"]),
    phrase(8, "See you later.", "Увидимся позже.", "Дружелюбное прощание.", "Приветствие", ["meet", "soon"]),
    phrase(9, "Have a good day.", "Хорошего дня.", "Очень частая вежливая фраза.", "Приветствие", ["make", "nice"]),
    phrase(10, "Talk to you soon.", "Скоро поговорим.", "Для переписки и звонков.", "Приветствие", ["with", "again"]),

    phrase(11, "I don't understand.", "Я не понимаю.", "Одна из самых важных фраз для выживания в разговоре.", "Понимание", ["can't", "know"]),
    phrase(12, "Can you repeat that?", "Можешь повторить это?", "Если не расслышал.", "Понимание", ["say", "again"]),
    phrase(13, "Please speak more slowly.", "Пожалуйста, говори медленнее.", "Главная фраза для тренировки реального общения.", "Понимание", ["fast", "little"]),
    phrase(14, "What does this mean?", "Что это значит?", "Спрашивай значение слова или фразы.", "Понимание", ["make", "where"]),
    phrase(15, "How do you say this in English?", "Как это сказать по-английски?", "Позволяет учиться прямо в разговоре.", "Понимание", ["speak", "word"]),
    phrase(16, "I have a question.", "У меня есть вопрос.", "Вежливо подключиться к разговору.", "Понимание", ["make", "answer"]),
    phrase(17, "I need help.", "Мне нужна помощь.", "Коротко и прямо.", "Понимание", ["want", "work"]),
    phrase(18, "Can you help me?", "Можешь мне помочь?", "Вежливая просьба.", "Понимание", ["need", "please"]),
    phrase(19, "I don't know.", "Я не знаю.", "Не бойся этой фразы, она нормальная.", "Понимание", ["understand", "can"]),
    phrase(20, "I think so.", "Думаю, да.", "Мягкое согласие, когда не уверен на 100%.", "Понимание", ["know", "that"]),

    phrase(21, "I would like coffee.", "Я бы хотел кофе.", "Вежливый заказ: I would like + вещь.", "Кафе", ["want", "drink"]),
    phrase(22, "Can I have water?", "Можно мне воды?", "Заказ или просьба.", "Кафе", ["make", "take"]),
    phrase(23, "The bill, please.", "Счёт, пожалуйста.", "Короткая ресторанная фраза.", "Кафе", ["check", "now"]),
    phrase(24, "How much is it?", "Сколько это стоит?", "Про цену.", "Кафе", ["many", "are"]),
    phrase(25, "I want this one.", "Я хочу вот это.", "Покупка или выбор.", "Кафе", ["that", "some"]),
    phrase(26, "Do you take cards?", "Вы принимаете карты?", "Оплата в магазине/кафе.", "Кафе", ["cash", "have"]),
    phrase(27, "Can I pay by card?", "Можно оплатить картой?", "Естественнее, чем дословное 'pay with card'.", "Кафе", ["money", "take"]),
    phrase(28, "I need a table for two.", "Мне нужен столик на двоих.", "В ресторане.", "Кафе", ["room", "people"]),
    phrase(29, "Is this seat free?", "Это место свободно?", "В кафе, автобусе, коворкинге.", "Кафе", ["chair", "open"]),
    phrase(30, "That was delicious.", "Это было вкусно.", "Комплимент еде.", "Кафе", ["good", "very"]),

    phrase(31, "Where is the bathroom?", "Где туалет?", "Одна из самых нужных travel-фраз.", "Путешествия", ["toilet", "room"]),
    phrase(32, "I'm looking for this address.", "Я ищу этот адрес.", "Покажи адрес на телефоне и скажи эту фразу.", "Путешествия", ["need", "place"]),
    phrase(33, "How do I get there?", "Как мне туда добраться?", "Вопрос о маршруте.", "Путешествия", ["go", "where"]),
    phrase(34, "Is it far from here?", "Это далеко отсюда?", "Уточнение расстояния.", "Путешествия", ["near", "there"]),
    phrase(35, "I need a taxi.", "Мне нужно такси.", "Короткая практичная фраза.", "Путешествия", ["bus", "car"]),
    phrase(36, "Can you show me on the map?", "Можешь показать мне на карте?", "Когда объяснение на слух сложно.", "Путешествия", ["phone", "street"]),
    phrase(37, "I have a reservation.", "У меня бронь.", "Отель/ресторан.", "Путешествия", ["ticket", "room"]),
    phrase(38, "Can I check in?", "Можно зарегистрироваться?", "В отеле или аэропорту.", "Путешествия", ["go", "out"]),
    phrase(39, "What time does it open?", "Во сколько это открывается?", "Магазин, музей, кафе.", "Путешествия", ["close", "when"]),
    phrase(40, "What time does it close?", "Во сколько это закрывается?", "Очень частый бытовой вопрос.", "Путешествия", ["open", "where"]),

    phrase(41, "I'm sorry.", "Извини / мне жаль.", "Извинение или сочувствие, зависит от контекста.", "Вежливость", ["please", "thanks"]),
    phrase(42, "No problem.", "Без проблем.", "Ответ на спасибо или извинение.", "Вежливость", ["issue", "bad"]),
    phrase(43, "Thank you so much.", "Большое спасибо.", "Теплее, чем просто thanks.", "Вежливость", ["very", "many"]),
    phrase(44, "You're welcome.", "Пожалуйста / не за что.", "Ответ на thank you.", "Вежливость", ["please", "thanks"]),
    phrase(45, "Excuse me.", "Извините.", "Чтобы обратиться к человеку или пройти.", "Вежливость", ["sorry", "hello"]),
    phrase(46, "That's okay.", "Всё нормально.", "Успокаивает человека.", "Вежливость", ["good", "right"]),
    phrase(47, "Don't worry.", "Не переживай.", "Поддержка.", "Вежливость", ["think", "sorry"]),
    phrase(48, "I appreciate it.", "Я ценю это.", "Красивее и глубже, чем thanks.", "Вежливость", ["need", "like"]),
    phrase(49, "Could you please help me?", "Не могли бы вы мне помочь?", "Очень вежливая просьба.", "Вежливость", ["can", "want"]),
    phrase(50, "May I ask you something?", "Можно кое-что спросить?", "Мягкий вход в вопрос.", "Вежливость", ["tell", "answer"]),

    phrase(51, "I'm busy right now.", "Я сейчас занят.", "Right now = прямо сейчас.", "Повседневное", ["today", "always"]),
    phrase(52, "I'll call you later.", "Я позвоню тебе позже.", "I'll = I will, естественно в речи.", "Повседневное", ["talk", "soon"]),
    phrase(53, "I'm on my way.", "Я уже в пути.", "Очень частая фраза в переписке.", "Повседневное", ["home", "there"]),
    phrase(54, "I'll be there soon.", "Я скоро буду там.", "Когда едешь к человеку.", "Повседневное", ["here", "now"]),
    phrase(55, "I'm running late.", "Я опаздываю.", "Говорят именно running late.", "Повседневное", ["going", "slow"]),
    phrase(56, "Let's meet tomorrow.", "Давай встретимся завтра.", "Let's + глагол = давай сделаем.", "Повседневное", ["today", "talk"]),
    phrase(57, "What are you doing?", "Что ты делаешь?", "Бытовой вопрос сейчас.", "Повседневное", ["where", "going"]),
    phrase(58, "I'm working right now.", "Я сейчас работаю.", "Right now ставит акцент на момент.", "Повседневное", ["busy", "today"]),
    phrase(59, "I need to go.", "Мне нужно идти.", "Мягко закончить разговор.", "Повседневное", ["come", "stay"]),
    phrase(60, "Let's keep in touch.", "Давай будем на связи.", "После знакомства или встречи.", "Повседневное", ["talk", "again"]),

    phrase(61, "I like this place.", "Мне нравится это место.", "Для кафе, города, квартиры.", "Мнение", ["love", "room"]),
    phrase(62, "I don't like it.", "Мне это не нравится.", "Прямое мнение.", "Мнение", ["want", "this"]),
    phrase(63, "It sounds good.", "Звучит хорошо.", "Ответ на предложение.", "Мнение", ["looks", "bad"]),
    phrase(64, "That makes sense.", "Это имеет смысл.", "Когда понял логику.", "Мнение", ["does", "right"]),
    phrase(65, "I'm not sure.", "Я не уверен.", "Мягкое сомнение.", "Мнение", ["know", "ready"]),
    phrase(66, "I agree with you.", "Я согласен с тобой.", "Agree with + человек.", "Мнение", ["for", "about"]),
    phrase(67, "I don't agree.", "Я не согласен.", "Прямое несогласие без грубости.", "Мнение", ["think", "like"]),
    phrase(68, "That's a good idea.", "Это хорошая идея.", "Частая реакция на предложение.", "Мнение", ["great", "plan"]),
    phrase(69, "I think you're right.", "Думаю, ты прав.", "Мягкое согласие.", "Мнение", ["know", "true"]),
    phrase(70, "Maybe next time.", "Может быть, в следующий раз.", "Вежливо отказаться.", "Мнение", ["another", "today"]),

    phrase(71, "Can we talk?", "Мы можем поговорить?", "Начать важный разговор.", "Разговор", ["speak", "say"]),
    phrase(72, "Tell me more.", "Расскажи подробнее.", "Продолжить разговор.", "Разговор", ["say", "again"]),
    phrase(73, "What do you mean?", "Что ты имеешь в виду?", "Когда смысл неясен.", "Разговор", ["make", "think"]),
    phrase(74, "I see what you mean.", "Я понимаю, что ты имеешь в виду.", "Показывает, что ты понял собеседника.", "Разговор", ["know", "say"]),
    phrase(75, "Let's talk about it.", "Давай поговорим об этом.", "About + тема.", "Разговор", ["with", "this"]),
    phrase(76, "Can I say something?", "Можно я кое-что скажу?", "Вежливо войти в диалог.", "Разговор", ["ask", "tell"]),
    phrase(77, "What happened?", "Что случилось?", "Очень частый вопрос.", "Разговор", ["did", "do"]),
    phrase(78, "Everything is fine.", "Всё нормально.", "Успокоить человека.", "Разговор", ["good", "okay"]),
    phrase(79, "I feel much better.", "Я чувствую себя намного лучше.", "Про самочувствие.", "Разговор", ["good", "more"]),
    phrase(80, "I'm happy to hear that.", "Рад это слышать.", "Естественная реакция на хорошие новости.", "Разговор", ["see", "know"])
  ];

  function speakingScenario(id, title, level, context, promptRu, target, tip, category) {
    return { id, title, level, context, promptRu, target, tip, category };
  }

  const SPEAKING_SCENARIOS = [
    speakingScenario(1, "Знакомство", "A0", "Ты впервые встретил человека.", "Скажи: приятно познакомиться.", "Nice to meet you.", "Коротко, вежливо, без лишней грамматики.", "Приветствие"),
    speakingScenario(2, "Как дела", "A0", "Тебя спросили: How are you?", "Ответь: у меня всё хорошо, спасибо.", "I'm good, thanks.", "В речи чаще говорят I'm good, а не I am fine.", "Приветствие"),
    speakingScenario(3, "Не понял", "A0", "Собеседник сказал слишком быстро.", "Попроси повторить.", "Can you repeat that?", "Can you... звучит мягко и естественно.", "Выживание"),
    speakingScenario(4, "Медленнее", "A0", "Английская речь слишком быстрая.", "Попроси говорить медленнее.", "Please speak more slowly.", "Это одна из самых полезных фраз для реальной практики.", "Выживание"),
    speakingScenario(5, "Нужна помощь", "A0", "Ты не можешь разобраться.", "Попроси помочь.", "Can you help me?", "Help me — помоги мне. Can you — можешь?", "Выживание"),
    speakingScenario(6, "Заказ кофе", "A1", "Ты в кафе.", "Скажи: я бы хотел кофе.", "I would like coffee.", "I would like — вежливее, чем I want.", "Кафе"),
    speakingScenario(7, "Попросить воду", "A1", "Ты в кафе или ресторане.", "Попроси воды.", "Can I have water?", "Can I have... — универсальная просьба.", "Кафе"),
    speakingScenario(8, "Спросить цену", "A1", "Ты покупаешь вещь.", "Спроси: сколько это стоит?", "How much is it?", "How much — про цену и количество.", "Покупки"),
    speakingScenario(9, "Оплата картой", "A1", "Ты хочешь оплатить.", "Спроси: можно оплатить картой?", "Can I pay by card?", "Pay by card — естественная фраза.", "Покупки"),
    speakingScenario(10, "Где туалет", "A1", "Ты в незнакомом месте.", "Спроси где туалет.", "Where is the bathroom?", "В США bathroom звучит естественнее, чем toilet.", "Путешествия"),
    speakingScenario(11, "Такси", "A1", "Ты хочешь уехать.", "Скажи: мне нужно такси.", "I need a taxi.", "I need + предмет/действие — базовый шаблон.", "Путешествия"),
    speakingScenario(12, "Маршрут", "A1", "Ты не знаешь как добраться.", "Спроси: как мне туда добраться?", "How do I get there?", "Get there = добраться туда.", "Путешествия"),
    speakingScenario(13, "Опаздываю", "A2", "Ты пишешь другу.", "Скажи: я опаздываю.", "I'm running late.", "По-английски говорят running late, не going late.", "Повседневное"),
    speakingScenario(14, "Я в пути", "A2", "Ты уже едешь.", "Скажи: я уже в пути.", "I'm on my way.", "Очень живая фраза для сообщений.", "Повседневное"),
    speakingScenario(15, "Позвоню позже", "A2", "Ты занят.", "Скажи: я позвоню позже.", "I'll call you later.", "I'll = I will. Так звучит естественно.", "Повседневное"),
    speakingScenario(16, "Мнение", "A2", "Тебе предложили идею.", "Скажи: звучит хорошо.", "It sounds good.", "Sounds good — короткая реакция на предложение.", "Мнение"),
    speakingScenario(17, "Не уверен", "A2", "Ты сомневаешься.", "Скажи: я не уверен.", "I'm not sure.", "Мягкий способ не соглашаться или сомневаться.", "Мнение"),
    speakingScenario(18, "Давай обсудим", "A2", "Есть важная тема.", "Предложи поговорить об этом.", "Let's talk about it.", "Let's + verb = давай сделаем.", "Разговор"),
    speakingScenario(19, "Что ты имеешь в виду", "A2", "Ты не понял смысл.", "Спроси что человек имеет в виду.", "What do you mean?", "Очень частая фраза в живом диалоге.", "Разговор"),
    speakingScenario(20, "Рад слышать", "A2", "Человек сказал хорошую новость.", "Скажи: рад это слышать.", "I'm happy to hear that.", "Вежливая реакция, звучит естественно.", "Разговор")
  ];

  const LEARNING_LEVELS = [
    { id: 'survival', title: 'Survival English', level: 'A0', goal: 'Выжить в разговоре', detail: 'Приветствие, помощь, просьбы, медленнее, повтори.', target: 20 },
    { id: 'daily', title: 'Daily Life', level: 'A1', goal: 'Говорить в бытовых ситуациях', detail: 'Кафе, магазин, такси, отель, простые вопросы.', target: 80 },
    { id: 'core', title: 'Core Words', level: 'A1-A2', goal: 'Собрать словарный фундамент', detail: 'NGSL слова + коллокации + примеры.', target: 700 },
    { id: 'dialogues', title: 'Real Dialogues', level: 'A2', goal: 'Держать мини-диалог', detail: 'Ответы голосом, сценарии и разбор ошибок.', target: 20 },
    { id: 'fluency', title: 'Fluency Loop', level: 'A2+', goal: 'Довести до автоматизма', detail: 'Повторение слабых мест и говорение каждый день.', target: 30 }
  ];
  
  // Состояния карточки в системе FSRS
  const CARD_STATE = {
    NEW: 0,        // Никогда не показывалась
    LEARNING: 1,   // В процессе изучения (первые повторы)
    REVIEW: 2,     // Изучена, повторяется по интервалам
    RELAPSED: 3    // Забыли — снова в обучении
  };
  
  // =======================================================================
  // FSRS — упрощённая реализация Free Spaced Repetition Scheduler
  // 
  // Идея: каждая карточка имеет два параметра:
  //   - stability (S): "стабильность" памяти, дни до того как 
  //     вероятность вспомнить упадёт до 90%
  //   - difficulty (D): сложность карточки от 1 до 10
  // 
  // При оценке мы пересчитываем эти параметры и определяем, 
  // через сколько дней показать карточку снова.
  // =======================================================================
  
  // Начальная стабильность для новых карточек, в зависимости от первой оценки
  // [Again, Hard, Good, Easy] — индекс соответствует rating - 1
  const INITIAL_STABILITY = [0.4, 1.2, 2.5, 6.0];
  
  // Целевой retention rate — вероятность вспомнить карточку при повторении
  const TARGET_RETENTION = 0.9;
  
  /**
   * Вычисляет следующий интервал повторения
   * @param {Object} card — карточка с полями state, stability, difficulty, lapses
   * @param {number} rating — оценка от 1 (Again) до 4 (Easy)
   * @returns {Object} обновлённая карточка
   */
  function fsrsNextReview(card, rating) {
    const now = Date.now();
    let { state, stability, difficulty, lapses, reps } = card;
    
    reps = (reps || 0) + 1;
    lapses = lapses || 0;
    
    // Если карточка новая — инициализируем
    if (state === CARD_STATE.NEW) {
      stability = INITIAL_STABILITY[rating - 1];
      difficulty = 5 - (rating - 3);  // 4=Easy → D=4, 3=Good → D=5, 2=Hard → D=6, 1=Again → D=7
      difficulty = Math.max(1, Math.min(10, difficulty));
      state = rating === 1 ? CARD_STATE.LEARNING : CARD_STATE.REVIEW;
    } else {
      // Уже имеющаяся карточка — обновляем стабильность и сложность
      
      if (rating === 1) {
        // Again — забыли. Сбрасываем стабильность, увеличиваем сложность
        stability = Math.max(0.4, stability * 0.2);
        difficulty = Math.min(10, difficulty + 1.5);
        lapses += 1;
        state = CARD_STATE.RELAPSED;
      } else {
        // Помним. Увеличиваем стабильность по формуле, инспирированной FSRS
        // Чем выше сложность — тем медленнее растёт стабильность
        // Чем выше оценка — тем быстрее
        const ratingFactor = [0, 0.85, 1.0, 1.3][rating - 1] || 1.0;
        const difficultyFactor = (11 - difficulty) / 10;
        const growth = 1 + (2.5 * difficultyFactor * ratingFactor);
        stability = stability * growth;
        
        // Сложность медленно меняется к среднему
        const dDelta = (rating - 3) * 0.15;
        difficulty = Math.max(1, Math.min(10, difficulty - dDelta));
        
        state = CARD_STATE.REVIEW;
      }
    }
    
    // Считаем интервал в днях из стабильности и желаемого retention
    // Формула FSRS: I = S * (ln(target_R) / ln(0.9))
    // Упрощённо: I ≈ S при target = 0.9
    let intervalDays = stability;
    
    // Минимумы для сразу-после-провала
    if (rating === 1) intervalDays = Math.max(0.007, intervalDays); // 10 мин минимум
    if (rating === 2 && state !== CARD_STATE.REVIEW) intervalDays = Math.max(0.04, intervalDays); // 1 час
    
    const nextDue = now + intervalDays * 86400000;
    
    return {
      ...card,
      state,
      stability,
      difficulty,
      lapses,
      reps,
      lastReview: now,
      due: nextDue,
      // Для отображения превью интервалов в кнопках
      lastInterval: intervalDays
    };
  }
  
  /**
   * Превью интервалов для кнопок Again/Hard/Good/Easy на UI
   * Считает интервал для каждой кнопки, не меняя карточку
   */
  function previewIntervals(card) {
    return [1, 2, 3, 4].map(r => {
      const result = fsrsNextReview({ ...card }, r);
      return result.lastInterval;
    });
  }
  
  /**
   * Форматирует интервал в человекочитаемый текст
   */
  function formatInterval(days) {
    if (days < 1/24) return `${Math.round(days * 24 * 60)}мин`;
    if (days < 1) return `${Math.round(days * 24)}ч`;
    if (days < 30) return `${Math.round(days)}д`;
    if (days < 365) return `${Math.round(days / 30)}мес`;
    return `${Math.round(days / 365)}г`;
  }
  
  // =======================================================================
  // STATE — единственный источник правды
  // =======================================================================
  
  let state = {
    cards: {},              // { [wordId]: { state, stability, difficulty, due, ... } }
    sessionStats: {         // Сегодняшняя сессия
      date: '',
      reviewed: 0,
      newLearned: 0,
      correct: 0,
      total: 0
    },
    streak: {
      current: 0,
      longest: 0,
      lastDay: ''
    },
    totalStats: {
      totalReviewed: 0,
      totalNewLearned: 0,
      totalDaysActive: 0
    },
    phraseStats: {
      completed: 0,
      attempts: 0,
      correct: 0,
      speakingAttempts: 0,
      spokenGood: 0,
      progress: {}
    },
    speakingStats: {
      attempts: 0,
      good: 0,
      completed: 0,
      progress: {}
    },
    settings: {
      newWordsPerDay: NEW_WORDS_PER_DAY,
      sessionGoal: SESSION_GOAL,
      onboarded: false
    },
    currentScreen: 'home',
    // Сессионные данные (не сохраняются)
    _sessionQueue: [],
    _currentCardIdx: 0,
    _showAnswer: false,
    _phraseQueue: [],
    _phraseIdx: 0,
    _phraseSelected: [],
    _phraseBank: [],
    _phraseResult: null,
    _phraseSpeechFeedback: null,
    _speakingIdx: 0,
    _speakingFeedback: null,
    _skippedWordIds: [],
    _skippedPhraseIds: []
  };
  
  // =======================================================================
  // ХРАНЕНИЕ — универсальный слой
  // 
  // Приложение должно работать в трёх сценариях:
  //   1) Открыто как HTML-файл локально (file://) — нужен localStorage
  //   2) Открыто на хостинге как PWA — тоже localStorage
  //   3) Открыто внутри артефакта Claude — там есть window.storage
  // 
  // Поэтому делаем абстракцию: пробуем window.storage, при ошибке падаем на 
  // localStorage. Так твой прогресс сохраняется надёжно везде.
  // =======================================================================
  
  const storage = {
    async get(key) {
      // Сначала пробуем window.storage (среда артефактов)
      if (typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function') {
        try {
          const result = await window.storage.get(key);
          return result;
        } catch (e) {
          // window.storage есть, но ключ не найден — это норма, идём в localStorage
        }
      }
      // Фолбэк на localStorage — работает в любом браузере
      try {
        const value = localStorage.getItem(key);
        return value !== null ? { key, value, shared: false } : null;
      } catch (e) {
        return null;
      }
    },
    
    async set(key, value) {
      if (typeof window !== 'undefined' && window.storage && typeof window.storage.set === 'function') {
        try {
          return await window.storage.set(key, value);
        } catch (e) {
          // Падаем на localStorage
        }
      }
      try {
        localStorage.setItem(key, value);
        return { key, value, shared: false };
      } catch (e) {
        console.error('localStorage недоступен:', e);
        return null;
      }
    },
    
    async delete(key) {
      if (typeof window !== 'undefined' && window.storage && typeof window.storage.delete === 'function') {
        try {
          return await window.storage.delete(key);
        } catch (e) {}
      }
      try {
        localStorage.removeItem(key);
        return { key, deleted: true };
      } catch (e) {
        return null;
      }
    }
  };
  
  async function loadState() {
    try {
      const result = await storage.get(STORAGE_KEY);
      if (result && result.value) {
        const saved = JSON.parse(result.value);
        // Сливаем сохранённое с дефолтным state, но не трогаем сессионные поля
        state = { 
          ...state, 
          ...saved,
          phraseStats: {
            ...state.phraseStats,
            ...(saved.phraseStats || {}),
            progress: {
              ...state.phraseStats.progress,
              ...((saved.phraseStats && saved.phraseStats.progress) || {})
            }
          },
          speakingStats: {
            ...state.speakingStats,
            ...(saved.speakingStats || {}),
            progress: {
              ...state.speakingStats.progress,
              ...((saved.speakingStats && saved.speakingStats.progress) || {})
            }
          },
          _sessionQueue: [],
          _currentCardIdx: 0,
          _showAnswer: false,
          _phraseQueue: [],
          _phraseIdx: 0,
          _phraseSelected: [],
          _phraseBank: [],
          _phraseResult: null,
          _phraseSpeechFeedback: null,
          _speakingIdx: 0,
          _speakingFeedback: null,
          _skippedWordIds: [],
          _skippedPhraseIds: []
        };
      }
    } catch (err) {
      console.log('No saved state, starting fresh');
    }
  }
  
  async function saveState() {
    try {
      const toSave = { ...state };
      delete toSave._sessionQueue;
      delete toSave._currentCardIdx;
      delete toSave._showAnswer;
      delete toSave._phraseQueue;
      delete toSave._phraseIdx;
      delete toSave._phraseSelected;
      delete toSave._phraseBank;
      delete toSave._phraseResult;
      delete toSave._phraseSpeechFeedback;
      delete toSave._speakingIdx;
      delete toSave._speakingFeedback;
      delete toSave._skippedWordIds;
      delete toSave._skippedPhraseIds;
      delete toSave._reviewLearnedMode;
      delete toSave.currentScreen;
      await storage.set(STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.error('Failed to save state:', err);
    }
  }
  
  // =======================================================================
  // СЕССИЯ — выбор карточек на сегодня
  // =======================================================================
  
  /**
   * Возвращает дату в формате YYYY-MM-DD для сравнения дней
   */
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  
  /**
   * Сбрасывает сессионную статистику если новый день, обновляет streak
   */
  function rolloverIfNewDay() {
    const today = todayKey();
    if (state.sessionStats.date !== today) {
      // Новый день
      const yesterday = state.sessionStats.date;
      const wasActiveYesterday = state.sessionStats.total > 0;
      
      if (wasActiveYesterday) {
        // Был активен в прошлый день — продляем стрик, если он был вчерашний
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yKey = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
        
        if (yesterday === yKey) {
          state.streak.current += 1;
        } else {
          state.streak.current = 1;
        }
        
        if (state.streak.current > state.streak.longest) {
          state.streak.longest = state.streak.current;
        }
        state.streak.lastDay = yesterday;
        state.totalStats.totalDaysActive += 1;
      }
      
      state.sessionStats = {
        date: today,
        reviewed: 0,
        newLearned: 0,
        correct: 0,
        total: 0
      };
    }
  }
  
  /**
   * Собирает очередь на изучение: due карточки + новые слова
   */
  function buildSessionQueue() {
    rolloverIfNewDay();
    const now = Date.now();
    const queue = [];
    
    // 1) Due карточки (нужно повторить)
    const dueCards = [];
    const skipped = new Set(state._skippedWordIds || []);
    for (const word of WORDS) {
      if (skipped.has(word.id)) continue;
      const card = state.cards[word.id];
      if (card && card.state !== CARD_STATE.NEW && card.due <= now) {
        dueCards.push(word);
      }
    }
    // Сортируем по убыванию просрочки (самые просроченные первыми)
    dueCards.sort((a, b) => state.cards[a.id].due - state.cards[b.id].due);
    queue.push(...dueCards);
    
    // 2) Новые слова — берём по N штук, если ещё не выучили норму
    const newToday = state.sessionStats.newLearned || 0;
    const newQuota = Math.max(0, state.settings.newWordsPerDay - newToday);
    
    if (newQuota > 0) {
      const newWords = [];
      for (const word of WORDS) {
        if (newWords.length >= newQuota) break;
        if (skipped.has(word.id)) continue;
        const card = state.cards[word.id];
        if (!card || card.state === CARD_STATE.NEW) {
          newWords.push(word);
        }
      }
      // Перемешиваем новые с просроченными для разнообразия
      for (const w of newWords) {
        const insertAt = Math.floor(Math.random() * (queue.length + 1));
        queue.splice(insertAt, 0, w);
      }
    }
    
    return queue;
  }
  
  // =======================================================================
  // РЕЖИМ "ПОВТОРИТЬ ВЫУЧЕННЫЕ" — отдельная очередь из освоенных слов
  //
  // Полезно когда: 1) хочется отшлифовать память по уже выученным;
  // 2) хочется заговорить — освоенные слова легко проходят, тренируется
  // активный отзыв и произношение.
  //
  // Очередь: все карточки в state REVIEW (включая RELAPSED), отсортированные
  // от наименее стабильных. Это значит: тренируем сначала те, что ближе
  // всего к забыванию.
  // =======================================================================

  function buildReviewLearnedQueue() {
    const learned = [];
    for (const word of WORDS) {
      const card = state.cards[word.id];
      if (!card) continue;
      if (card.state === CARD_STATE.NEW) continue;
      // Все слова что уже учил — и освоенные, и в процессе
      learned.push(word);
    }
    // Сортируем от наименее стабильных (хрупкая память) к самым крепким
    learned.sort((a, b) => {
      const sa = state.cards[a.id].stability || 0;
      const sb = state.cards[b.id].stability || 0;
      return sa - sb;
    });
    // Берём до 30 карточек на сессию повторения
    return learned.slice(0, 30);
  }

  function startReviewLearnedMode() {
    const queue = buildReviewLearnedQueue();
    if (queue.length === 0) {
      toast('Сначала выучи хотя бы несколько слов');
      return;
    }
    state._sessionQueue = queue;
    state._currentCardIdx = 0;
    state._showAnswer = false;
    state._reviewLearnedMode = true;
    navigate('learn');
  }

  /**
   * Обрабатывает оценку текущей карточки
   */
  async function processRating(rating) {
    const word = state._sessionQueue[state._currentCardIdx];
    if (!word) return;
    
    const oldCard = state.cards[word.id] || {
      state: CARD_STATE.NEW,
      stability: 0,
      difficulty: 5,
      lapses: 0,
      reps: 0
    };
    
    const wasNew = oldCard.state === CARD_STATE.NEW;
    const newCard = fsrsNextReview(oldCard, rating);
    state.cards[word.id] = newCard;
    
    // Статистика
    state.sessionStats.total += 1;
    if (rating >= 3) state.sessionStats.correct += 1;
    if (wasNew) {
      state.sessionStats.newLearned += 1;
      state.totalStats.totalNewLearned += 1;
    } else {
      state.sessionStats.reviewed += 1;
      state.totalStats.totalReviewed += 1;
    }
    
    // Если "Again" — карточка вернётся в конец очереди для повтора
    if (rating === 1) {
      const w = state._sessionQueue.splice(state._currentCardIdx, 1)[0];
      // Возвращаем через несколько карточек
      const insertAt = Math.min(state._sessionQueue.length, state._currentCardIdx + 3);
      state._sessionQueue.splice(insertAt, 0, w);
    } else {
      state._currentCardIdx += 1;
    }
    
    state._showAnswer = false;
    await saveState();
    renderLearnScreen();
  }

  async function skipCurrentWord() {
    const word = state._sessionQueue[state._currentCardIdx];
    if (!word) return;
    state._skippedWordIds = Array.from(new Set([...(state._skippedWordIds || []), word.id]));
    state._sessionQueue.splice(state._currentCardIdx, 1);
    if (state._currentCardIdx >= state._sessionQueue.length) {
      state._currentCardIdx = Math.max(0, state._sessionQueue.length - 1);
    }
    state._showAnswer = false;
    toast('Пропущено в этой сессии');
    renderLearnScreen();
  }

  async function markCurrentWordMastered() {
    const word = state._sessionQueue[state._currentCardIdx];
    if (!word) return;
    const now = Date.now();
    const oldCard = state.cards[word.id] || {
      state: CARD_STATE.NEW,
      stability: 0,
      difficulty: 5,
      lapses: 0,
      reps: 0
    };
    const wasNew = oldCard.state === CARD_STATE.NEW;
    state.cards[word.id] = {
      ...oldCard,
      state: CARD_STATE.REVIEW,
      stability: Math.max(oldCard.stability || 0, 120),
      difficulty: Math.max(1, Math.min(10, (oldCard.difficulty || 5) - 2)),
      reps: (oldCard.reps || 0) + 1,
      lastReview: now,
      due: now + 120 * 86400000,
      lastInterval: 120,
      manuallyMastered: true
    };
    state.sessionStats.total += 1;
    state.sessionStats.correct += 1;
    if (wasNew) {
      state.sessionStats.newLearned += 1;
      state.totalStats.totalNewLearned += 1;
    } else {
      state.sessionStats.reviewed += 1;
      state.totalStats.totalReviewed += 1;
    }
    state._sessionQueue.splice(state._currentCardIdx, 1);
    if (state._currentCardIdx >= state._sessionQueue.length) {
      state._currentCardIdx = Math.max(0, state._sessionQueue.length - 1);
    }
    state._showAnswer = false;
    await saveState();
    toast('Отмечено как выученное');
    renderLearnScreen();
  }
  
  // =======================================================================
  // КОЛЛОКАЦИИ — типичные сочетания слов
  //
  // По исследованиям: коллокации (естественные комбинации, "make a decision",
  // "heavy rain") — ключ к естественной речи. Возвращаем массив объектов
  // {en, ru} для подсветки в карточке.
  // =======================================================================

  function getCollocations(word) {
    // Если у слова есть собственные коллокации в данных — используем их
    if (Array.isArray(word.col) && word.col.length > 0) {
      return word.col;
    }
    // Иначе — пусто (старые слова без поля col просто не будут показывать блок)
    return [];
  }

  // =======================================================================
  // ОЗВУЧКА — Web Speech API
  // =======================================================================
  
  // =======================================================================
  // ОЗВУЧКА — улучшенная: выбираем лучший доступный голос, медленнее,
  // делаем паузу между словом и примером, кэшируем выбор голоса
  // =======================================================================

  let _selectedVoice = null;
  let _voicesReady = false;

  // Приоритетные голоса (топовые "Enhanced/Premium/Neural" движки систем)
  const PREFERRED_VOICES = [
    // macOS / iOS — высококачественные голоса
    'Samantha', 'Karen', 'Daniel', 'Moira', 'Tessa',
    // Google — натуральные нейроголоса
    'Google US English', 'Google UK English Female', 'Google UK English Male',
    // Microsoft — natural neural
    'Microsoft Aria Online', 'Microsoft Jenny Online', 'Microsoft Guy Online',
    'Microsoft Zira', 'Microsoft David',
  ];

  function pickBestVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    // 1) Приоритетные голоса по имени
    for (const name of PREFERRED_VOICES) {
      const v = voices.find(v => v.name.includes(name) || v.name === name);
      if (v) return v;
    }
    // 2) Любой английский голос с пометкой "Enhanced/Premium/Natural/Neural"
    const fancy = voices.find(v => /^en/i.test(v.lang) &&
      /(enhanced|premium|natural|neural|online)/i.test(v.name));
    if (fancy) return fancy;
    // 3) Любой en-US или en-GB
    return voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB')
      || voices.find(v => /^en/i.test(v.lang)) || null;
  }

  function ensureVoices() {
    if (_voicesReady) return;
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      _selectedVoice = pickBestVoice();
      _voicesReady = true;
    } else {
      // Голоса грузятся асинхронно — ловим событие
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        _selectedVoice = pickBestVoice();
        _voicesReady = true;
      }, { once: true });
    }
  }

  function speak(text, opts = {}) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (!_voicesReady) ensureVoices();

    const utter = new SpeechSynthesisUtterance(text);
    if (_selectedVoice) utter.voice = _selectedVoice;
    utter.lang = (_selectedVoice && _selectedVoice.lang) || 'en-US';
    // Медленнее по умолчанию: 0.8 (норма) / 0.55 (медленно). Чёткое произношение = ниже rate.
    utter.rate = opts.slow ? 0.55 : 0.8;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    window.speechSynthesis.speak(utter);
  }

  // Озвучка примера для тренировки слуха
  function speakExample(word) {
    if (!word || !word.ex) return;
    speak(word.ex);
  }

  // Озвучить слово, сделать паузу, потом пример (audio-first обучение)
  function speakWordThenExample(word) {
    if (!word) return;
    speak(word.en);
    if (word.ex) {
      // Длительность зависит от длины слова — ~600мс на слово в обычном темпе
      const wait = 800 + word.en.length * 60;
      setTimeout(() => speakExample(word), wait);
    }
  }

  function getLearningSnapshot() {
    let masteredCount = 0;
    let learningCount = 0;
    let dueCount = 0;
    const now = Date.now();
    for (const word of WORDS) {
      const card = state.cards[word.id];
      if (!card) continue;
      if (card.state === CARD_STATE.REVIEW && card.stability > 30) masteredCount++;
      else if (card.state !== CARD_STATE.NEW) learningCount++;
      if (card.state !== CARD_STATE.NEW && card.due <= now) dueCount++;
    }
    const newAvailable = Math.max(0, state.settings.newWordsPerDay - state.sessionStats.newLearned);
    const phraseAccuracy = state.phraseStats.attempts > 0
      ? Math.round(state.phraseStats.correct / state.phraseStats.attempts * 100)
      : 0;
    const speakingAccuracy = state.speakingStats.attempts > 0
      ? Math.round(state.speakingStats.good / state.speakingStats.attempts * 100)
      : 0;
    return { masteredCount, learningCount, dueCount, newAvailable, phraseAccuracy, speakingAccuracy };
  }

  function getAdaptivePlan(snapshot) {
    if (snapshot.dueCount >= 10) {
      return {
        badge: 'Память',
        title: 'Сегодня закрепляем слова',
        detail: 'Много слов созрело к повтору. Сначала убираем риск забывания, потом фразы.',
        steps: [
          { id: 'words', n: 1, title: `Повтори ${snapshot.dueCount} слов`, detail: 'Самые срочные карточки первыми' },
          { id: 'phrases', n: 2, title: 'Собери 3 фразы', detail: 'Переведи слова в готовые предложения' },
          { id: 'speak', n: 3, title: 'Скажи 2 реплики', detail: 'Короткая голосовая практика' }
        ]
      };
    }
    if (state.phraseStats.completed < 10 || snapshot.phraseAccuracy < 70) {
      return {
        badge: 'Фразы',
        title: 'Сегодня строим предложения',
        detail: 'Тебе нужно больше автоматизма в порядке слов. Это быстрее ведёт к разговору.',
        steps: [
          { id: 'phrases', n: 1, title: 'Собери 5 фраз', detail: 'Фокус на бытовые предложения' },
          { id: 'speak', n: 2, title: 'Произнеси 3 фразы', detail: 'Сразу закрепи голосом' },
          { id: 'words', n: 3, title: `Добери ${snapshot.newAvailable} слов`, detail: 'Только если есть силы' }
        ]
      };
    }
    if (state.speakingStats.attempts < 5 || snapshot.speakingAccuracy < 75) {
      return {
        badge: 'Речь',
        title: 'Сегодня говорим вслух',
        detail: 'Пассивное знание уже есть. Теперь тренируем уверенность и скорость ответа.',
        steps: [
          { id: 'speak', n: 1, title: 'Пройди 5 speaking-сценариев', detail: 'Кафе, просьбы, знакомство' },
          { id: 'phrases', n: 2, title: 'Собери слабые фразы', detail: 'Порядок слов без угадывания' },
          { id: 'words', n: 3, title: 'Лёгкое повторение', detail: 'Без перегруза новыми словами' }
        ]
      };
    }
    return {
      badge: 'Баланс',
      title: 'Сбалансированный урок',
      detail: 'Память, фразы и речь идут ровно. Держим ежедневный темп.',
      steps: [
        { id: 'words', n: 1, title: 'Карточки 5 минут', detail: 'Повтор + немного новых слов' },
        { id: 'phrases', n: 2, title: 'Собери 5 фраз', detail: 'Бытовые предложения' },
        { id: 'speak', n: 3, title: 'Скажи 5 реплик', detail: 'Голосом, медленно и чётко' }
      ]
    };
  }
  
  // =======================================================================
  // НАВИГАЦИЯ
  // =======================================================================
  
  function navigate(screen) {
    state.currentScreen = screen;
    const tabs = document.querySelectorAll('.tab');
    const screens = ['home', 'learn', 'speak', 'phrases', 'vocab', 'profile'];
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.screen === screen);
    });
    // Двигаем индикатор активной вкладки (плавная пилюля)
    const idx = screens.indexOf(screen);
    const indicator = document.getElementById('tabIndicator');
    if (indicator && idx >= 0) {
      const activeTab = tabs[idx];
      if (activeTab) {
        indicator.style.width = `${activeTab.offsetWidth}px`;
        indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
      }
    }
    render();
  }

  // =======================================================================
  // CONFETTI — мини-салют при завершении сессии
  // =======================================================================

  function celebrate() {
    const colors = ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF453A', '#FFD60A'];
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 0.5) + 's';
      piece.style.animationDuration = (1.8 + Math.random() * 1.4) + 's';
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      container.appendChild(piece);
    }
    setTimeout(() => container.remove(), 4000);
  }
  
  function render() {
    switch (state.currentScreen) {
      case 'home':    renderHomeScreen(); break;
      case 'learn':   renderLearnScreen(); break;
      case 'speak':   renderSpeakScreen(); break;
      case 'phrases': renderPhrasesScreen(); break;
      case 'vocab':   renderVocabScreen(); break;
      case 'profile': renderProfileScreen(); break;
    }
  }
  
  // =======================================================================
  // РЕНДЕР: ГЛАВНЫЙ ЭКРАН
  // =======================================================================
  
  function renderHomeScreen() {
    rolloverIfNewDay();
    
    const main = document.getElementById('main');
    
    const snapshot = getLearningSnapshot();
    const { masteredCount, learningCount, dueCount, newAvailable } = snapshot;
    const adaptivePlan = getAdaptivePlan(snapshot);
    const todayTotal = dueCount + newAvailable;
    const progressPct = state.settings.sessionGoal > 0 
      ? Math.min(100, Math.round(state.sessionStats.total / state.settings.sessionGoal * 100))
      : 0;
    
    const greeting = (() => {
      const h = new Date().getHours();
      if (h < 6) return 'Доброй ночи';
      if (h < 12) return 'Доброе утро';
      if (h < 18) return 'Добрый день';
      return 'Добрый вечер';
    })();
    
    main.innerHTML = `
      <div class="screen active">
        <div class="large-title">${greeting} 👋</div>
        
        ${state.streak.current > 0 ? `
          <div class="streak-banner">
            <div class="flame">🔥</div>
            <div class="text">
              <div class="num">${state.streak.current}</div>
              <div class="lab">${pluralRu(state.streak.current, 'день', 'дня', 'дней')} подряд</div>
            </div>
          </div>
        ` : ''}
        
        <div class="progress-ring-card">
          <div style="position: relative; width: 70px; height: 70px;">
            ${progressRingSvg(progressPct)}
          </div>
          <div class="ring-info">
            <div class="label">Прогресс на сегодня</div>
            <div class="number">${state.sessionStats.total} <span style="font-size: 16px; opacity: 0.7;">/ ${state.settings.sessionGoal}</span></div>
            <div class="sub">${state.sessionStats.total >= state.settings.sessionGoal ? '✓ Цель достигнута' : `Осталось ${state.settings.sessionGoal - state.sessionStats.total}`}</div>
          </div>
        </div>

        <div class="coach-card">
          <div class="coach-head">
            <div>
              <div class="headline">${adaptivePlan.title}</div>
              <div class="footnote">${adaptivePlan.detail}</div>
            </div>
            <div class="coach-badge">${adaptivePlan.badge}</div>
          </div>
          <div class="coach-steps">
            ${adaptivePlan.steps.map(step => `
              <button class="coach-step" data-coach="${step.id}">
                <span class="n">${step.n}</span>
                <span>
                  <span style="display:block; font-weight:700;">${step.title}</span>
                  <span class="footnote">${step.detail}</span>
                </span>
                <span class="go">›</span>
              </button>
            `).join('')}
          </div>
        </div>
        
        <button class="btn btn-primary" id="startSessionBtn" style="margin-bottom: 8px;">
          ${todayTotal > 0 ? `▶︎ Учить (${todayTotal})` : 'Все повторено! Учить ещё?'}
        </button>
        ${learningCount + masteredCount > 0 ? `
          <button class="btn btn-secondary" id="reviewLearnedBtn" style="margin-bottom: 12px;">
            ↻ Повторить выученные (${learningCount + masteredCount})
          </button>
        ` : ''}

        <div class="phrase-hero" id="phraseHero" style="cursor: pointer;">
          <div class="phrase-hero-icon">💬</div>
          <div style="flex: 1;">
            <div class="headline">Собирай живые предложения</div>
            <div class="footnote">80 бытовых фраз: кафе, поездки, просьбы, знакомства, разговор.</div>
          </div>
          <div style="color: var(--text-tertiary); font-size: 24px;">›</div>
        </div>

        <div class="section-title">Путь к разговору</div>
        <div class="level-path">
          ${LEARNING_LEVELS.map(level => {
            const progress = getLevelProgress(level, { masteredCount, learningCount });
            return `
              <div class="level-card">
                <div class="level-top">
                  <span class="level-chip">${level.level}</span>
                  <span class="level-percent">${progress}%</span>
                </div>
                <div class="headline">${level.title}</div>
                <div class="footnote">${level.goal}</div>
                <div class="level-bar"><span style="width:${progress}%"></span></div>
                <div class="caption">${level.detail}</div>
              </div>
            `;
          }).join('')}
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background: var(--warning-soft); color: var(--warning);">
              <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="stat-label">К повтору сегодня</div>
            <div class="stat-value">${dueCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background: var(--accent-soft); color: var(--accent);">
              <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <div class="stat-label">Новых доступно</div>
            <div class="stat-value">${newAvailable}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background: var(--purple-soft); color: var(--purple);">
              <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </div>
            <div class="stat-label">В изучении</div>
            <div class="stat-value">${learningCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background: var(--success-soft); color: var(--success);">
              <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="stat-label">Освоено</div>
            <div class="stat-value">${masteredCount}</div>
          </div>
        </div>
        
        <div class="section-title">База NGSL</div>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
            <div class="headline">Покрытие английского</div>
            <div style="font-size: 28px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums;">
              ${Math.round((learningCount + masteredCount) / WORDS.length * 100)}%
            </div>
          </div>
          <div style="height: 6px; background: var(--bg-elevated-2); border-radius: 3px; overflow: hidden;">
            <div style="height: 100%; width: ${(learningCount + masteredCount) / WORDS.length * 100}%; background: linear-gradient(90deg, var(--accent), var(--purple)); border-radius: 3px;"></div>
          </div>
          <div class="footnote" style="margin-top: 8px;">
            Изучено ${learningCount + masteredCount} из ${WORDS.length} слов NGSL. Полный набор покрывает 92% английских текстов.
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('startSessionBtn').addEventListener('click', () => {
      // Сбрасываем режим повторения выученных при запуске обычного обучения
      state._reviewLearnedMode = false;
      state._sessionQueue = [];
      state._currentCardIdx = 0;
      navigate('learn');
    });
    const rlb = document.getElementById('reviewLearnedBtn');
    if (rlb) rlb.addEventListener('click', () => startReviewLearnedMode());
    document.getElementById('phraseHero').addEventListener('click', () => navigate('phrases'));
    document.querySelectorAll('[data-coach]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.coach;
        if (target === 'words') {
          state._reviewLearnedMode = false;
          state._sessionQueue = [];
          state._currentCardIdx = 0;
          navigate('learn');
        }
        if (target === 'phrases') navigate('phrases');
        if (target === 'speak') navigate('speak');
      });
    });
  }

  function getLevelProgress(level, counts = {}) {
    if (level.id === 'survival') {
      return Math.min(100, Math.round(state.phraseStats.completed / 20 * 100));
    }
    if (level.id === 'daily') {
      return Math.min(100, Math.round(state.phraseStats.completed / PHRASES.length * 100));
    }
    if (level.id === 'core') {
      return Math.min(100, Math.round(((counts.learningCount || 0) + (counts.masteredCount || 0)) / WORDS.length * 100));
    }
    if (level.id === 'dialogues') {
      return Math.min(100, Math.round(state.speakingStats.completed / SPEAKING_SCENARIOS.length * 100));
    }
    if (level.id === 'fluency') {
      return Math.min(100, Math.round((state.speakingStats.good || 0) / 30 * 100));
    }
    return 0;
  }
  
  // SVG-кольцо прогресса
  function progressRingSvg(percent) {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    return `
      <svg width="70" height="70" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r="${radius}" stroke="rgba(255,255,255,0.25)" stroke-width="6" fill="none"/>
        <circle cx="35" cy="35" r="${radius}" stroke="white" stroke-width="6" fill="none"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 35 35)"
          style="transition: stroke-dashoffset 0.5s ease;"/>
        <text x="35" y="40" text-anchor="middle" fill="white" font-size="16" font-weight="700">${percent}%</text>
      </svg>
    `;
  }
  
  // Русская плюрализация: 1 день, 2 дня, 5 дней
  function pluralRu(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }
  
  // =======================================================================
  // РЕНДЕР: ЭКРАН ОБУЧЕНИЯ
  // =======================================================================
  
  function renderLearnScreen() {
    const main = document.getElementById('main');
    
    // Если нет очереди или она кончилась — собираем новую
    if (state._sessionQueue.length === 0 || state._currentCardIdx >= state._sessionQueue.length) {
      // В режиме повторения выученных — не пересобираем (он закончился = выходим)
      if (state._reviewLearnedMode) {
        state._reviewLearnedMode = false;
        state._sessionQueue = [];
        state._currentCardIdx = 0;
        navigate('home');
        toast('Повторение выученных завершено!');
        return;
      }
      state._sessionQueue = buildSessionQueue();
      state._currentCardIdx = 0;
      state._showAnswer = false;
    }
    
    if (state._sessionQueue.length === 0) {
      // Все на сегодня выучено — салют 🎉
      const accuracy = state.sessionStats.total > 0 ? Math.round(state.sessionStats.correct / state.sessionStats.total * 100) : 0;
      main.innerHTML = `
        <div class="screen active">
          <div class="session-done">
            <div class="emoji pulse">🎉</div>
            <h2>Всё на сегодня!</h2>
            <p>Ты повторил все слова к сегодняшнему дню. Возвращайся завтра — карточки появятся по интервалам.</p>
            <div class="session-stats">
              <div class="session-stat">
                <div class="v">${state.sessionStats.total}</div>
                <div class="l">слов</div>
              </div>
              <div class="session-stat">
                <div class="v">${state.sessionStats.newLearned}</div>
                <div class="l">новых</div>
              </div>
              <div class="session-stat">
                <div class="v">${accuracy}%</div>
                <div class="l">точность</div>
              </div>
            </div>
            <button class="btn btn-primary" id="reviewLearnedBtn" style="margin-bottom: 8px;">Повторить уже выученные</button>
            <button class="btn btn-secondary" id="goHomeBtn">На главную</button>
          </div>
        </div>
      `;
      document.getElementById('goHomeBtn').addEventListener('click', () => navigate('home'));
      document.getElementById('reviewLearnedBtn').addEventListener('click', () => {
        startReviewLearnedMode();
      });
      // Запускаем салют только если была реальная активность в этой сессии
      if (state.sessionStats.total > 0) {
        setTimeout(celebrate, 200);
      }
      return;
    }
    
    const word = state._sessionQueue[state._currentCardIdx];
    const card = state.cards[word.id] || { state: CARD_STATE.NEW, stability: 0, difficulty: 5, lapses: 0, reps: 0 };
    const isNew = card.state === CARD_STATE.NEW;
    const total = state._sessionQueue.length;
    const current = state._currentCardIdx + 1;
    
    const previews = previewIntervals(card);
    
    // Получаем коллокации/использование (новое поле, fallback на пример)
    const collocations = getCollocations(word);
    const usageHint = word.use || word.usage || '';
    const simpleMeaning = word.simple || ''; // Простое объяснение значения

    main.innerHTML = `
      <div class="screen active">
        <div class="large-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>${state._reviewLearnedMode ? 'Повторение' : 'Учить'}</span>
          <span style="font-size: 17px; font-weight: 500; color: var(--text-secondary); font-variant-numeric: tabular-nums;">
            ${current} / ${total}
          </span>
        </div>
        <div class="task-actions">
          <button class="mini-action" id="skipWordBtn">Пропустить</button>
          <button class="mini-action strong" id="masterWordBtn">Уже знаю</button>
        </div>
        ${state._reviewLearnedMode ? `
          <div style="background: rgba(191, 90, 242, 0.15); border: 0.5px solid rgba(191, 90, 242, 0.25); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px; color: rgba(220, 180, 255, 0.95); font-size: 14px;">
            🔁 Режим повторения уже выученных слов — закрепляешь самые хрупкие сначала.
          </div>
        ` : ''}

        <div class="flashcard-wrap">
          <div class="flashcard flip-in" id="flashcard">
            <div class="flashcard-meta">
              <span>${isNew ? '✨ Новое' : '↻ Повтор'}</span>
              <span>Band ${word.band}</span>
            </div>

            <div class="word">${word.en}</div>
            <div class="pos">${word.pos}</div>
            <div class="ipa">${word.ipa}</div>
            <div class="ru-translit">
              <span>${word.ru}</span>
              <button class="speak-btn" id="speakBtn" aria-label="Произнести">
                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              </button>
            </div>

            <!-- Перевод теперь всегда виден — родной язык как опора для понимания -->
            <div class="translation">${word.tr}</div>

            ${simpleMeaning ? `
              <div style="font-size: 14px; color: var(--text-secondary); margin: -4px 8px 10px; line-height: 1.4;">
                ${simpleMeaning}
              </div>
            ` : ''}

            ${usageHint ? `
              <div class="usage-hint">
                <strong>💡 Как использовать:</strong> ${usageHint}
              </div>
            ` : ''}

            <div class="example" id="exampleBlock" style="cursor: pointer;" title="Нажми чтобы прослушать">
              <span class="en-ex">"${word.ex}" 🔊</span>
              <span class="ru-ex">${word.exTr}</span>
            </div>

            ${state._showAnswer ? `
              <div class="pronunciation-rule">
                <span class="rule-icon">🔊</span><strong>Произношение:</strong> ${word.rule}
              </div>
              ${collocations.length > 0 ? `
                <div class="collocations-box">
                  <span class="col-title">Частые сочетания</span>
                  <ul>
                    ${collocations.map(c => `<li><b>${c.en}</b> — ${c.ru}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            ` : ''}
          </div>
        </div>

        ${state._showAnswer ? `
          <div class="rating-row">
            <button class="rate-btn rate-again" data-rate="1">
              Снова
              <span class="interval">${formatInterval(previews[0])}</span>
            </button>
            <button class="rate-btn rate-hard" data-rate="2">
              Сложно
              <span class="interval">${formatInterval(previews[1])}</span>
            </button>
            <button class="rate-btn rate-good" data-rate="3">
              Хорошо
              <span class="interval">${formatInterval(previews[2])}</span>
            </button>
            <button class="rate-btn rate-easy" data-rate="4">
              Легко
              <span class="interval">${formatInterval(previews[3])}</span>
            </button>
          </div>
        ` : `
          <button class="show-answer-btn" id="showAnswerBtn">Понятно — оценить себя</button>
        `}
      </div>
    `;
    
    // Озвучка слова при показе. Если ответ открыт — после слова идёт пример (audio-first)
    setTimeout(() => {
      if (state._showAnswer) {
        speakWordThenExample(word);
      } else {
        speak(word.en);
      }
    }, 250);

    // Обработчики
    document.getElementById('skipWordBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      skipCurrentWord();
    });
    document.getElementById('masterWordBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      markCurrentWordMastered();
    });

    document.getElementById('speakBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      speak(word.en);
    });

    // Двойной тап на слове — медленное произношение
    let lastWordTap = 0;
    const wordEl = document.querySelector('.flashcard .word');
    if (wordEl) {
      wordEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const now = Date.now();
        if (now - lastWordTap < 400) {
          speak(word.en, { slow: true });
        } else {
          speak(word.en);
        }
        lastWordTap = now;
      });
    }

    // Тап по примеру — озвучить
    const exampleEl = document.getElementById('exampleBlock');
    if (exampleEl) {
      exampleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        speakExample(word);
      });
    }
    
    if (state._showAnswer) {
      document.querySelectorAll('.rate-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const rating = parseInt(btn.dataset.rate, 10);
          processRating(rating);
        });
      });
    } else {
      const btn = document.getElementById('showAnswerBtn');
      btn.addEventListener('click', () => {
        state._showAnswer = true;
        renderLearnScreen();
      });
      
      // Тап по карточке тоже показывает ответ
      document.getElementById('flashcard').addEventListener('click', () => {
        state._showAnswer = true;
        renderLearnScreen();
      });
    }
  }

  // =======================================================================
  // РЕНДЕР: ГОВОРЕНИЕ — главный режим для быстрых разговорных результатов
  // =======================================================================

  function getSpeakingQueue() {
    return [...SPEAKING_SCENARIOS].sort((a, b) => {
      const pa = state.speakingStats.progress[a.id] || {};
      const pb = state.speakingStats.progress[b.id] || {};
      const aScore = (pa.completed ? 3 : 0) + (pa.bestScore || 0) / 100 + (pa.attempts || 0) * 0.02;
      const bScore = (pb.completed ? 3 : 0) + (pb.bestScore || 0) / 100 + (pb.attempts || 0) * 0.02;
      return aScore - bScore;
    });
  }

  function currentSpeakingScenario() {
    const queue = getSpeakingQueue();
    if (state._speakingIdx >= queue.length) state._speakingIdx = 0;
    return queue[state._speakingIdx] || SPEAKING_SCENARIOS[0];
  }

  function nextSpeakingScenario() {
    state._speakingIdx += 1;
    state._speakingFeedback = null;
    renderSpeakScreen();
  }

  function startScenarioSpeechPractice() {
    const scenario = currentSpeakingScenario();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast('Браузер не поддерживает распознавание речи');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => toast('Слушаю... отвечай на английском');
    recognition.onerror = () => toast('Не расслышал. Попробуй ещё раз');
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript || '';
      const score = scoreSpeech(scenario.target, transcript);
      const progress = state.speakingStats.progress[scenario.id] || { attempts: 0, bestScore: 0, completed: false };
      progress.attempts += 1;
      progress.bestScore = Math.max(progress.bestScore || 0, score);
      state.speakingStats.attempts += 1;
      if (score >= 75) {
        state.speakingStats.good += 1;
        if (!progress.completed) state.speakingStats.completed += 1;
        progress.completed = true;
      }
      state.speakingStats.progress[scenario.id] = progress;
      state._speakingFeedback = {
        transcript,
        score,
        ok: score >= 75,
        advice: score >= 75
          ? 'Хорошо. Теперь попробуй сказать быстрее, но не проглатывай окончания.'
          : 'Скажи медленнее и попади в ключевые слова. Сначала повтори за озвучкой.'
      };
      await saveState();
      renderSpeakScreen();
    };
    recognition.start();
  }

  function renderSpeakScreen() {
    const main = document.getElementById('main');
    const scenario = currentSpeakingScenario();
    const progress = state.speakingStats.progress[scenario.id] || {};
    const accuracy = state.speakingStats.attempts > 0
      ? Math.round(state.speakingStats.good / state.speakingStats.attempts * 100)
      : 0;

    main.innerHTML = `
      <div class="screen active">
        <div class="large-title" style="display:flex; justify-content:space-between; align-items:center;">
          <span>Говорение</span>
          <span style="font-size:15px; color:var(--text-secondary); font-weight:650;">${state.speakingStats.completed} / ${SPEAKING_SCENARIOS.length}</span>
        </div>

        <div class="speaking-hero">
          <div class="speaking-orb">🎙</div>
          <div>
            <div class="headline">Отвечай голосом, как в реальном разговоре</div>
            <div class="footnote">Точность: ${accuracy}% · Лучший результат здесь: ${progress.bestScore || 0}%</div>
          </div>
        </div>

        <div class="scenario-card">
          <div class="scenario-meta">
            <span>${scenario.level}</span>
            <span>${scenario.category}</span>
          </div>
          <h2>${scenario.title}</h2>
          <p>${scenario.context}</p>
          <div class="prompt-ru">${scenario.promptRu}</div>
          <div class="footnote">${scenario.tip}</div>
        </div>

        ${state._speakingFeedback ? `
          <div class="speech-feedback">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px;">
              <strong>${state._speakingFeedback.ok ? 'Засчитано' : 'Нужно ещё раз'}</strong>
              <span class="score-pill">${state._speakingFeedback.score}%</span>
            </div>
            <div style="color:var(--text-secondary);">Я услышал: "${escapeHtml(state._speakingFeedback.transcript)}"</div>
            <div style="color:var(--text-secondary); margin-top:6px;">Лучший вариант: "${scenario.target}"</div>
            <div style="margin-top:8px;">${state._speakingFeedback.advice}</div>
          </div>
        ` : ''}

        <div class="phrase-actions">
          <button class="btn btn-secondary" id="listenScenarioBtn">🔊 Послушать</button>
          <button class="btn btn-primary" id="speakScenarioBtn">🎙 Сказать</button>
        </div>
        <div class="phrase-actions" style="margin-top:10px;">
          <button class="btn btn-secondary" id="showScenarioAnswerBtn">Показать ответ</button>
          <button class="btn btn-secondary" id="nextScenarioBtn">Дальше</button>
        </div>
      </div>
    `;

    document.getElementById('listenScenarioBtn').addEventListener('click', () => speak(scenario.target, { slow: true }));
    document.getElementById('speakScenarioBtn').addEventListener('click', startScenarioSpeechPractice);
    document.getElementById('showScenarioAnswerBtn').addEventListener('click', () => {
      state._speakingFeedback = {
        transcript: 'подсказка',
        score: progress.bestScore || 0,
        ok: false,
        advice: `Скажи так: "${scenario.target}"`
      };
      speak(scenario.target, { slow: true });
      renderSpeakScreen();
    });
    document.getElementById('nextScenarioBtn').addEventListener('click', nextSpeakingScenario);

    if (!progress.attempts && !state._speakingFeedback) {
      setTimeout(() => speak(scenario.target, { slow: true }), 350);
    }
  }

  // =======================================================================
  // РЕНДЕР: ФРАЗЫ — сборка повседневных предложений
  // =======================================================================

  function shuffleArray(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeEnglish(text) {
    return String(text)
      .toLowerCase()
      .replace(/’/g, "'")
      .replace(/\bi'm\b/g, 'im')
      .replace(/\bi'll\b/g, 'ill')
      .replace(/\bdon't\b/g, 'dont')
      .replace(/\bwhat's\b/g, 'whats')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function scoreSpeech(expected, heard) {
    const expectedTokens = normalizeEnglish(expected).split(' ').filter(Boolean);
    const heardTokens = normalizeEnglish(heard).split(' ').filter(Boolean);
    if (!expectedTokens.length || !heardTokens.length) return 0;
    let matches = 0;
    const used = new Set();
    expectedTokens.forEach(token => {
      const idx = heardTokens.findIndex((h, i) => !used.has(i) && h === token);
      if (idx >= 0) {
        used.add(idx);
        matches += 1;
      }
    });
    return Math.round(matches / expectedTokens.length * 100);
  }

  function explainPhraseMistake(phraseItem, chosen) {
    if (!chosen.length) {
      return 'Начни с первого смыслового блока. В английском обычно порядок такой: кто делает → действие → что/где/когда.';
    }
    const expected = phraseItem.answer;
    const firstWrong = chosen.findIndex((token, idx) => token !== expected[idx]);
    if (firstWrong >= 0) {
      const need = expected[firstWrong];
      const got = chosen[firstWrong];
      return `Ошибка в позиции ${firstWrong + 1}: здесь нужно "${need}", а у тебя "${got}". Английский очень любит фиксированный порядок слов.`;
    }
    if (chosen.length < expected.length) {
      return `Фраза почти собрана, но не хватает: "${expected.slice(chosen.length).join(' ')}".`;
    }
    return 'Есть лишние слова. Убери всё, что не входит в правильную фразу.';
  }

  function startPhraseSpeechPractice() {
    const phraseItem = currentPhrase();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast('Браузер не поддерживает распознавание речи');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => toast('Слушаю... скажи фразу вслух');
    recognition.onerror = () => toast('Не расслышал. Попробуй ещё раз');
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript || '';
      const score = scoreSpeech(phraseItem.en, transcript);
      state._phraseSpeechFeedback = {
        transcript,
        score,
        ok: score >= 75
      };
      state.phraseStats.speakingAttempts = (state.phraseStats.speakingAttempts || 0) + 1;
      if (score >= 75) state.phraseStats.spokenGood = (state.phraseStats.spokenGood || 0) + 1;
      await saveState();
      renderPhrasesScreen();
    };
    recognition.start();
  }

  function buildPhraseQueue() {
    const skipped = new Set(state._skippedPhraseIds || []);
    return [...PHRASES].sort((a, b) => {
      const pa = state.phraseStats.progress[a.id] || {};
      const pb = state.phraseStats.progress[b.id] || {};
      if (skipped.has(a.id) && !skipped.has(b.id)) return 1;
      if (!skipped.has(a.id) && skipped.has(b.id)) return -1;
      const aScore = (pa.completed ? 2 : 0) + (pa.correct || 0) * 0.1 - (pa.attempts || 0) * 0.01;
      const bScore = (pb.completed ? 2 : 0) + (pb.correct || 0) * 0.1 - (pb.attempts || 0) * 0.01;
      return aScore - bScore;
    });
  }

  function preparePhraseRound(phraseItem) {
    const tokens = phraseItem.answer.map((text, idx) => ({
      id: `${phraseItem.id}-a-${idx}`,
      text,
      answer: true
    }));
    const distractors = phraseItem.distractors.map((text, idx) => ({
      id: `${phraseItem.id}-d-${idx}`,
      text,
      answer: false
    }));
    state._phraseBank = shuffleArray([...tokens, ...distractors]);
    state._phraseSelected = [];
    state._phraseResult = null;
    state._phraseSpeechFeedback = null;
  }

  function currentPhrase() {
    if (!state._phraseQueue.length || state._phraseIdx >= state._phraseQueue.length) {
      state._phraseQueue = buildPhraseQueue();
      state._phraseIdx = 0;
    }
    const phraseItem = state._phraseQueue[state._phraseIdx];
    if (phraseItem && !state._phraseBank.length) preparePhraseRound(phraseItem);
    return phraseItem;
  }

  async function checkPhraseAnswer() {
    const phraseItem = currentPhrase();
    if (!phraseItem) return;
    const chosen = state._phraseSelected.map(id => state._phraseBank.find(t => t.id === id)?.text).filter(Boolean);
    const isCorrect = chosen.length === phraseItem.answer.length &&
      chosen.every((token, idx) => token === phraseItem.answer[idx]);

    const progress = state.phraseStats.progress[phraseItem.id] || { attempts: 0, correct: 0, completed: false };
    progress.attempts += 1;
    state.phraseStats.attempts += 1;

    if (isCorrect) {
      progress.correct += 1;
      state.phraseStats.correct += 1;
      if (!progress.completed) state.phraseStats.completed += 1;
      progress.completed = true;
      state._phraseResult = 'ok';
      speak(phraseItem.en, { slow: true });
    } else {
      state._phraseResult = 'bad';
      speak(phraseItem.en, { slow: true });
    }

    state.phraseStats.progress[phraseItem.id] = progress;
    await saveState();
    renderPhrasesScreen();
  }

  function nextPhrase() {
    state._phraseIdx += 1;
    if (state._phraseIdx >= state._phraseQueue.length) {
      state._phraseQueue = buildPhraseQueue();
      state._phraseIdx = 0;
    }
    const phraseItem = state._phraseQueue[state._phraseIdx];
    preparePhraseRound(phraseItem);
    renderPhrasesScreen();
  }

  function skipPhrase() {
    const phraseItem = currentPhrase();
    if (!phraseItem) return;
    state._skippedPhraseIds = Array.from(new Set([...(state._skippedPhraseIds || []), phraseItem.id]));
    toast('Фраза пропущена');
    nextPhrase();
  }

  async function markPhraseMastered() {
    const phraseItem = currentPhrase();
    if (!phraseItem) return;
    const progress = state.phraseStats.progress[phraseItem.id] || { attempts: 0, correct: 0, completed: false };
    if (!progress.completed) state.phraseStats.completed += 1;
    progress.completed = true;
    progress.correct = Math.max(progress.correct || 0, 1);
    progress.attempts = Math.max(progress.attempts || 0, 1);
    progress.manuallyMastered = true;
    state.phraseStats.progress[phraseItem.id] = progress;
    await saveState();
    toast('Фраза отмечена как выученная');
    nextPhrase();
  }

  function renderPhrasesScreen() {
    const main = document.getElementById('main');
    const phraseItem = currentPhrase();
    if (!phraseItem) return;

    const progress = state.phraseStats.progress[phraseItem.id] || {};
    const selectedTokens = state._phraseSelected
      .map(id => state._phraseBank.find(t => t.id === id))
      .filter(Boolean);
    const selectedText = selectedTokens.map(t => t.text).join(' ');
    const mistakeExplanation = state._phraseResult === 'bad'
      ? explainPhraseMistake(phraseItem, selectedTokens.map(t => t.text))
      : '';
    const phraseAccuracy = state.phraseStats.attempts > 0
      ? Math.round(state.phraseStats.correct / state.phraseStats.attempts * 100)
      : 0;

    main.innerHTML = `
      <div class="screen active">
        <div class="large-title" style="display:flex; align-items:center; justify-content:space-between;">
          <span>Фразы</span>
          <span style="font-size: 15px; color: var(--text-secondary); font-weight: 600;">
            ${state.phraseStats.completed} / ${PHRASES.length}
          </span>
        </div>
        <div class="task-actions">
          <button class="mini-action" id="skipPhraseBtn">Пропустить</button>
          <button class="mini-action strong" id="masterPhraseBtn">Уже знаю</button>
        </div>

        <div class="phrase-hero">
          <div class="phrase-hero-icon">🎯</div>
          <div>
            <div class="headline">Собери фразу для реального разговора</div>
            <div class="footnote">Точность: ${phraseAccuracy}% · Категория: ${phraseItem.category}</div>
          </div>
        </div>

        <div class="card">
          <div class="section-title" style="margin-top: 0;">Переведи на английский</div>
          <div style="font-size: 24px; font-weight: 750; letter-spacing: -0.02em; margin-bottom: 8px;">${phraseItem.ru}</div>
          <div class="footnote" style="line-height: 1.45;">${phraseItem.tip}</div>
        </div>

        <div class="phrase-builder ${selectedTokens.length ? '' : 'empty'}" id="phraseBuilder">
          ${selectedTokens.length ? selectedTokens.map(t => `
            <button class="phrase-token selected" data-selected-id="${t.id}">${t.text}</button>
          `).join('') : 'Нажимай слова снизу в правильном порядке'}
        </div>

        <div class="word-bank">
          ${state._phraseBank.map(t => `
            <button class="phrase-token ${state._phraseSelected.includes(t.id) ? 'used' : ''}" data-token-id="${t.id}">
              ${t.text}
            </button>
          `).join('')}
        </div>

        ${state._phraseResult ? `
          <div class="phrase-result ${state._phraseResult === 'ok' ? 'ok' : 'bad'}">
            ${state._phraseResult === 'ok' ? `
              <strong style="color: var(--success);">Верно.</strong> ${phraseItem.en}<br>
              <span style="color: var(--text-secondary);">${phraseItem.tip}</span>
            ` : `
              <strong style="color: var(--danger);">Почти.</strong> Правильно: <b>${phraseItem.en}</b><br>
              <span style="color: var(--text-secondary);">Твой вариант: ${selectedText || 'пусто'}</span><br>
              <span style="display:block; margin-top: 8px;"><b>Почему:</b> ${mistakeExplanation}</span>
            `}
          </div>
        ` : ''}

        ${state._phraseSpeechFeedback ? `
          <div class="speech-feedback">
            <div style="display:flex; align-items:center; justify-content:space-between; gap: 12px; margin-bottom: 8px;">
              <strong>${state._phraseSpeechFeedback.ok ? 'Произношение хорошее' : 'Нужно чётче'}</strong>
              <span class="score-pill">${state._phraseSpeechFeedback.score}%</span>
            </div>
            <div style="color: var(--text-secondary);">Я услышал: "${escapeHtml(state._phraseSpeechFeedback.transcript)}"</div>
            <div style="color: var(--text-secondary); margin-top: 6px;">Цель: "${phraseItem.en}"</div>
          </div>
        ` : ''}

        <div class="phrase-actions">
          <button class="btn btn-secondary" id="clearPhraseBtn">Очистить</button>
          ${state._phraseResult === 'ok' ? `
            <button class="btn btn-primary" id="nextPhraseBtn">Следующая</button>
          ` : `
            <button class="btn btn-primary" id="checkPhraseBtn">Проверить</button>
          `}
        </div>

        <button class="btn btn-secondary" id="hearPhraseBtn" style="margin-top: 10px;">🔊 Прослушать правильную фразу</button>
        <button class="btn btn-secondary" id="speakPhraseBtn" style="margin-top: 10px;">🎙 Сказать вслух</button>
      </div>
    `;

    document.getElementById('skipPhraseBtn').addEventListener('click', skipPhrase);
    document.getElementById('masterPhraseBtn').addEventListener('click', markPhraseMastered);

    document.querySelectorAll('[data-token-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.tokenId;
        if (!state._phraseSelected.includes(id)) {
          state._phraseSelected.push(id);
          state._phraseResult = null;
          state._phraseSpeechFeedback = null;
          renderPhrasesScreen();
        }
      });
    });

    document.querySelectorAll('[data-selected-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.selectedId;
        state._phraseSelected = state._phraseSelected.filter(x => x !== id);
        state._phraseResult = null;
        state._phraseSpeechFeedback = null;
        renderPhrasesScreen();
      });
    });

    document.getElementById('clearPhraseBtn').addEventListener('click', () => {
      state._phraseSelected = [];
      state._phraseResult = null;
      state._phraseSpeechFeedback = null;
      renderPhrasesScreen();
    });

    const checkBtn = document.getElementById('checkPhraseBtn');
    if (checkBtn) checkBtn.addEventListener('click', checkPhraseAnswer);

    const nextBtn = document.getElementById('nextPhraseBtn');
    if (nextBtn) nextBtn.addEventListener('click', nextPhrase);

    document.getElementById('hearPhraseBtn').addEventListener('click', () => speak(phraseItem.en, { slow: true }));
    document.getElementById('speakPhraseBtn').addEventListener('click', startPhraseSpeechPractice);

    if (!progress.attempts) {
      setTimeout(() => speak(phraseItem.en, { slow: true }), 350);
    }
  }
  
  // =======================================================================
  // РЕНДЕР: СЛОВАРЬ
  // =======================================================================
  
  let vocabFilter = { search: '', band: 0, status: 'all' }; // status: all | new | learning | mastered
  
  function renderVocabScreen() {
    const main = document.getElementById('main');
    const now = Date.now();
    
    const getStatus = (word) => {
      const card = state.cards[word.id];
      if (!card || card.state === CARD_STATE.NEW) return 'new';
      if (card.state === CARD_STATE.REVIEW && card.stability > 30) return 'mastered';
      if (card.due <= now) return 'review';
      return 'learning';
    };
    
    let filtered = WORDS.filter(w => {
      if (vocabFilter.band !== 0 && w.band !== vocabFilter.band) return false;
      if (vocabFilter.status !== 'all' && getStatus(w) !== vocabFilter.status) return false;
      if (vocabFilter.search) {
        const q = vocabFilter.search.toLowerCase().trim();
        if (!w.en.toLowerCase().includes(q) && !w.tr.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    
    const statusCounts = {
      all: WORDS.length,
      new: 0, learning: 0, review: 0, mastered: 0
    };
    for (const w of WORDS) statusCounts[getStatus(w)]++;
    
    main.innerHTML = `
      <div class="screen active">
        <div class="large-title">Словарь</div>
        
        <div class="search-bar">
          <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="vocabSearch" placeholder="Поиск слова..." value="${vocabFilter.search}">
        </div>
        
        <div class="chip-row">
          <button class="chip ${vocabFilter.status === 'all' ? 'active' : ''}" data-status="all">Все · ${statusCounts.all}</button>
          <button class="chip ${vocabFilter.status === 'review' ? 'active' : ''}" data-status="review">Повторить · ${statusCounts.review}</button>
          <button class="chip ${vocabFilter.status === 'learning' ? 'active' : ''}" data-status="learning">Учу · ${statusCounts.learning}</button>
          <button class="chip ${vocabFilter.status === 'mastered' ? 'active' : ''}" data-status="mastered">Освоено · ${statusCounts.mastered}</button>
          <button class="chip ${vocabFilter.status === 'new' ? 'active' : ''}" data-status="new">Новые · ${statusCounts.new}</button>
        </div>
        
        <div id="wordList">
          ${filtered.length === 0 ? `
            <div class="empty">
              <div class="em-icon">🔍</div>
              <div class="em-title">Ничего не найдено</div>
              <div class="em-text">Попробуй изменить фильтры или поисковый запрос.</div>
            </div>
          ` : filtered.map(w => {
            const st = getStatus(w);
            return `
              <div class="word-item" data-id="${w.id}">
                <div class="status status-${st}"></div>
                <div class="main">
                  <div class="en">${w.en} <span style="color: var(--text-tertiary); font-weight: 400; font-size: 13px;">${w.ipa}</span></div>
                  <div class="ru">${w.tr}</div>
                </div>
                <span class="chevron" style="color: var(--text-tertiary);">›</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    // Поиск
    const searchInput = document.getElementById('vocabSearch');
    searchInput.addEventListener('input', (e) => {
      vocabFilter.search = e.target.value;
      // Перерисовываем только список, чтобы не терять фокус инпута
      renderVocabList(filtered);
      // Полный ререндер с дебаунсом, чтобы счётчики обновились
      clearTimeout(searchInput._t);
      searchInput._t = setTimeout(() => {
        const cur = searchInput.value;
        renderVocabScreen();
        const newInput = document.getElementById('vocabSearch');
        newInput.focus();
        newInput.setSelectionRange(cur.length, cur.length);
      }, 300);
    });
    
    // Чипы статусов
    document.querySelectorAll('.chip[data-status]').forEach(c => {
      c.addEventListener('click', () => {
        vocabFilter.status = c.dataset.status;
        renderVocabScreen();
      });
    });
    
    // Тап по слову — открыть детализацию
    document.querySelectorAll('.word-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id, 10);
        const word = WORDS.find(w => w.id === id);
        if (word) showWordDetail(word);
      });
    });
  }
  
  function renderVocabList(words) {
    // Заглушка — используется в дебаунсе
  }
  
  // =======================================================================
  // МОДАЛКА ДЕТАЛИЗАЦИИ СЛОВА
  // =======================================================================
  
  function showWordDetail(word) {
    const card = state.cards[word.id];
    const overlay = document.getElementById('wordModal');
    const content = document.getElementById('wordModalContent');
    
    let statusText = 'Новое слово';
    let statusColor = 'var(--text-tertiary)';
    if (card && card.state !== CARD_STATE.NEW) {
      if (card.state === CARD_STATE.REVIEW && card.stability > 30) {
        statusText = `✓ Освоено · стабильность ${Math.round(card.stability)}д`;
        statusColor = 'var(--success)';
      } else {
        const dueIn = card.due - Date.now();
        const dueText = dueIn <= 0 ? 'сейчас' : `через ${formatInterval(dueIn / 86400000)}`;
        statusText = `↻ В изучении · повтор ${dueText}`;
        statusColor = 'var(--accent)';
      }
    }
    
    const collocations = getCollocations(word);
    const usageHint = word.use || word.usage || '';
    const simpleMeaning = word.simple || '';

    content.innerHTML = `
      <div class="modal-grabber"></div>
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
        <div>
          <h2>${word.en}</h2>
          <div style="color: var(--text-tertiary); font-style: italic; font-size: 13px; margin-bottom: 8px;">${word.pos}</div>
          <div class="modal-ipa">${word.ipa}</div>
          <div class="modal-translit">${word.ru}</div>
        </div>
        <button class="speak-btn" id="modalSpeak" style="margin-top: 4px;">
          <svg fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        </button>
      </div>

      <div style="font-size: 24px; font-weight: 700; margin: 16px 0 4px; letter-spacing: -0.02em;">${word.tr}</div>
      ${simpleMeaning ? `<div style="color: var(--text-secondary); font-size: 15px; margin-bottom: 12px; line-height: 1.45;">${simpleMeaning}</div>` : ''}

      ${usageHint ? `
        <div class="modal-section">
          <div class="modal-section-label">Как использовать</div>
          <div class="usage-hint" style="margin-top: 4px;">${usageHint}</div>
        </div>
      ` : ''}

      <div class="modal-section">
        <div class="modal-section-label">Произношение</div>
        <div class="pronunciation-rule" style="margin-top: 4px;">${word.rule}</div>
      </div>

      <div class="modal-section">
        <div class="modal-section-label">Пример</div>
        <div style="font-size: 17px; margin-top: 4px;">"${word.ex}"</div>
        <div style="color: var(--text-secondary); font-size: 15px; margin-top: 4px;">${word.exTr}</div>
      </div>

      ${collocations.length > 0 ? `
        <div class="modal-section">
          <div class="modal-section-label">Частые сочетания</div>
          <div class="collocations-box" style="margin-top: 4px;">
            <ul>
              ${collocations.map(c => `<li><b>${c.en}</b> — ${c.ru}</li>`).join('')}
            </ul>
          </div>
        </div>
      ` : ''}

      <div class="modal-section">
        <div class="modal-section-label">Статус</div>
        <div style="color: ${statusColor}; font-size: 15px; margin-top: 4px; font-weight: 500;">${statusText}</div>
      </div>

      <div class="modal-section">
        <div class="modal-section-label">Метаданные</div>
        <div class="footnote">Частотность: #${word.id} в NGSL · Уровень: Band ${word.band}</div>
      </div>

      <button class="btn btn-secondary" id="closeModalBtn" style="margin-top: 24px;">Закрыть</button>
    `;
    
    overlay.classList.add('active');
    setTimeout(() => speak(word.en), 250);
    
    document.getElementById('modalSpeak').addEventListener('click', () => speak(word.en));
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }
  
  function closeModal() {
    document.getElementById('wordModal').classList.remove('active');
  }
  
  // =======================================================================
  // РЕНДЕР: ПРОФИЛЬ
  // =======================================================================
  
  function renderProfileScreen() {
    const main = document.getElementById('main');
    
    let totalReps = 0;
    let totalLapses = 0;
    let learnedWords = 0;
    let masteredWords = 0;
    
    for (const word of WORDS) {
      const card = state.cards[word.id];
      if (!card || card.state === CARD_STATE.NEW) continue;
      totalReps += card.reps || 0;
      totalLapses += card.lapses || 0;
      learnedWords += 1;
      if (card.state === CARD_STATE.REVIEW && card.stability > 30) masteredWords += 1;
    }
    
    const accuracyAll = totalReps > 0 ? Math.round((1 - totalLapses / (totalReps + totalLapses)) * 100) : 0;
    
    main.innerHTML = `
      <div class="screen active">
        <div class="large-title">Профиль</div>
        
        <div class="card" style="display: flex; align-items: center; gap: 16px; padding: 20px;">
          <div style="width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, var(--accent), var(--purple)); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: white;">L</div>
          <div>
            <div class="headline">Lexa Learner</div>
            <div class="footnote">Изучаю английский по системе NGSL</div>
          </div>
        </div>
        
        <div class="section-title">Серия</div>
        <div>
          <div class="card-row">
            <span class="label">Текущая серия</span>
            <span class="value">🔥 ${state.streak.current} ${pluralRu(state.streak.current, 'день', 'дня', 'дней')}</span>
          </div>
          <div class="card-row">
            <span class="label">Рекорд</span>
            <span class="value">🏆 ${state.streak.longest} ${pluralRu(state.streak.longest, 'день', 'дня', 'дней')}</span>
          </div>
          <div class="card-row">
            <span class="label">Активных дней</span>
            <span class="value">${state.totalStats.totalDaysActive}</span>
          </div>
        </div>
        
        <div class="section-title">Прогресс</div>
        <div>
          <div class="card-row">
            <span class="label">Изучается слов</span>
            <span class="value">${learnedWords} / ${WORDS.length}</span>
          </div>
          <div class="card-row">
            <span class="label">Освоено (стабильно)</span>
            <span class="value">${masteredWords}</span>
          </div>
          <div class="card-row">
            <span class="label">Всего повторений</span>
            <span class="value">${totalReps}</span>
          </div>
          <div class="card-row">
            <span class="label">Точность ответов</span>
            <span class="value">${accuracyAll}%</span>
          </div>
          <div class="card-row">
            <span class="label">Фраз собрано</span>
            <span class="value">${state.phraseStats.completed} / ${PHRASES.length}</span>
          </div>
          <div class="card-row">
            <span class="label">Произношение фраз</span>
            <span class="value">${state.phraseStats.spokenGood || 0} / ${state.phraseStats.speakingAttempts || 0}</span>
          </div>
          <div class="card-row">
            <span class="label">Speaking-сценарии</span>
            <span class="value">${state.speakingStats.completed} / ${SPEAKING_SCENARIOS.length}</span>
          </div>
          <div class="card-row">
            <span class="label">Новых сегодня</span>
            <span class="value">${state.sessionStats.newLearned} / ${state.settings.newWordsPerDay}</span>
          </div>
        </div>
        
        <div class="section-title">Настройки</div>
        <div>
          <div class="card-row tappable" id="settingNewPerDay">
            <span class="label">Новых слов в день</span>
            <span class="value">${state.settings.newWordsPerDay} <span class="chevron">›</span></span>
          </div>
          <div class="card-row tappable" id="settingGoal">
            <span class="label">Цель сессии</span>
            <span class="value">${state.settings.sessionGoal} <span class="chevron">›</span></span>
          </div>
        </div>
        
        <div class="section-title">Как учиться эффективно</div>
        <div class="card">
          <div class="footnote" style="line-height: 1.55;">
            <strong style="color: var(--text-primary);">1. Коллокации > отдельные слова.</strong> Запоминай "make a decision", а не просто "make". Так звучишь естественно.<br><br>
            <strong style="color: var(--text-primary);">2. Слушай и повторяй вслух.</strong> Тапни 🔊 один раз — норм. скорость, дважды — медленно. Повторяй за озвучкой.<br><br>
            <strong style="color: var(--text-primary);">3. Собирай фразы.</strong> Слова становятся речью только в предложениях: "I'm on my way", "Can you repeat that?", "I need help".<br><br>
            <strong style="color: var(--text-primary);">4. Учись каждый день.</strong> 15-20 мин ежедневно > 2 часа раз в неделю. FSRS подаёт карточки точно перед забыванием.<br><br>
            <strong style="color: var(--text-primary);">5. Не торопись с "Легко".</strong> Если есть малейшие сомнения — "Хорошо". Так алгоритм правильно настроится.
          </div>
        </div>

        <div class="section-title">О приложении</div>
        <div class="card">
          <div class="footnote" style="line-height: 1.5;">
            <strong style="color: var(--text-primary);">Lexa</strong> использует NGSL — научно обоснованный список 2 800 самых частотных английских слов из Cambridge English Corpus, дающий 92% покрытия английских текстов. В приложении уже ${WORDS.length} слов с переводом, транскрипцией, простыми объяснениями и коллокациями.<br><br>
            Алгоритм повторений основан на FSRS — современном стандарте, который на 20-30% эффективнее классического SM-2 (Anki).
          </div>
        </div>
        
        <div style="margin-top: 24px;">
          <button class="btn btn-secondary" id="resetBtn" style="background: var(--danger-soft); color: var(--danger);">
            Сбросить весь прогресс
          </button>
        </div>
      </div>
    `;
    
    // Настройки — простые prompt диалоги (минимализм)
    document.getElementById('settingNewPerDay').addEventListener('click', () => {
      const v = prompt('Сколько новых слов в день? (1-30)', state.settings.newWordsPerDay);
      const n = parseInt(v, 10);
      if (n >= 1 && n <= 30) {
        state.settings.newWordsPerDay = n;
        saveState();
        renderProfileScreen();
        toast('Сохранено');
      }
    });
    
    document.getElementById('settingGoal').addEventListener('click', () => {
      const v = prompt('Цель повторений за день? (5-100)', state.settings.sessionGoal);
      const n = parseInt(v, 10);
      if (n >= 5 && n <= 100) {
        state.settings.sessionGoal = n;
        saveState();
        renderProfileScreen();
        toast('Сохранено');
      }
    });
    
    document.getElementById('resetBtn').addEventListener('click', () => {
      if (confirm('Удалить весь прогресс? Это действие нельзя отменить.')) {
        state.cards = {};
        state.sessionStats = { date: '', reviewed: 0, newLearned: 0, correct: 0, total: 0 };
        state.streak = { current: 0, longest: 0, lastDay: '' };
        state.totalStats = { totalReviewed: 0, totalNewLearned: 0, totalDaysActive: 0 };
        state.phraseStats = { completed: 0, attempts: 0, correct: 0, speakingAttempts: 0, spokenGood: 0, progress: {} };
        state.speakingStats = { attempts: 0, good: 0, completed: 0, progress: {} };
        saveState();
        renderProfileScreen();
        toast('Прогресс сброшен');
      }
    });
  }
  
  // =======================================================================
  // TOAST уведомления
  // =======================================================================
  
  function toast(text) {
    const t = document.getElementById('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2000);
  }
  
  // =======================================================================
  // ИНИЦИАЛИЗАЦИЯ
  // =======================================================================
  
  async function init() {
    await loadState();
    ensureVoices(); // Подгружаем список голосов заранее, чтобы первая озвучка была качественной

    // Привязка табов
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => navigate(tab.dataset.screen));
    });
    
    // Онбординг
    if (!state.settings.onboarded) {
      document.getElementById('onboarding').classList.remove('hidden');
      document.getElementById('startBtn').addEventListener('click', async () => {
        state.settings.onboarded = true;
        await saveState();
        document.getElementById('onboarding').classList.add('hidden');
        navigate('home');
      });
    } else {
      document.getElementById('onboarding').classList.add('hidden');
      navigate('home');
    }
  }
  
  // Запуск
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
