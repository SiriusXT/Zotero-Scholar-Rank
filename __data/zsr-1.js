
Components.utils.import('resource://gre/modules/Services.jsm');

$__zsr = {};


$__zsr.debugger = {
  /**
   * Print an info message to the console
   * @param {string} message
   */
  info: function (message) {
    this.__debugMessage(message, 3);
  },
  /**
   * Print an error message to the console
   * @param {string} message
   */
  warn: function (message) {
    this.__debugMessage(message, 1);
  },
  /**
   * Print an warning message to the console
   * @param {string} message
   */
  error: function (message) {
    this.__debugMessage(message, 0);
  },
  /**
   * Print a message to the debug console
   * @param {string} message
   * @param {number} level
   * @param {number} maxDepth
   * @param {object} stack
   */
  __debugMessage: function (message, level = 3, maxDepth = 5, stack = null) {
    const prependMessage = `[ZSR]: ${message}`;
    Zotero.Debug.log(prependMessage, level, maxDepth, stack);
  },
};

$__zsr.localization = {
  /**
   * All the strings below get replaced by the localization process; they're
   * there as description fallbacks only
   */
  string: {
    lackPermissions: 'You lack the permission to make edit to this library.',
    unSupportedGroupCollection:
      'You lack the permission to make edit to this library.',
    unSupportedEntryType: 'Updating a Group is not yet implemented.',
  },
  translate: function () {
    const stringBundle = document.getElementById('zsr-bundle');

    if (stringBundle !== null) {
      Object.keys(this.string).map((key) => {
        this.string[key] = stringBundle.getString(key);
      });
    }
  },
};

$__zsr.preferences = {
  /**
   * Prefs lookup keys for use with get()
   */
  keys: {
    USE_RANDOM_WAIT: 'useRandomWait',
    RANDOM_WAIT_MIN_MS: 'randomWaitMinMs',
    RANDOM_WAIT_MAX_MS: 'randomWaitMaxMs',
  },
  /**
   * Setup some baseline prefs
   * @private
   */
  __preferences: {
    useRandomWait: true,
    randomWaitMinMs: 1000,
    randomWaitMaxMs: 5000,
  },
  /**
   * Defines the Preference Service lookup branch
   * @private
   */
  __preferenceBranch: 'extensions.zsr.',
  /**
   * Set up the default values for the preferences branch store
   */
  install: function () {
    Object.keys(this.__preferences).map((key) => {
      this.set(key, this.__preferences[key]);
    });
  },
  /**
   * Get the handle from the Services.prefs for ZSR branch
   * @returns PrefsBranch
   */
  getBranch: function () {
    return Services.prefs.getBranch(this.__preferenceBranch);
  },
  /**
   * Get a value for the preference from ZSR branch
   * @param {string} pref
   * @param {boolean} throwError
   * @returns string|number|boolean
   */
  get: function (pref, throwError = false) {
    const preferenceBranch = this.getBranch();
    let preferenceValue;
    try {
      switch (preferenceBranch.getPrefType(pref)) {
        case preferenceBranch.PREF_BOOL:
          preferenceValue = preferenceBranch.getBoolPref(pref);
          break;
        case preferenceBranch.PREF_STRING:
          preferenceValue = preferenceBranch.getCharPref(pref);
          break;
        case preferenceBranch.PREF_INT:
          preferenceValue = preferenceBranch.getIntPref(pref);
          break;
      }
    } catch (e) {
      if (throwError) {
        throw new Error('[ZSR]: no pref found');
      } else {
        preferenceValue = this.__preferences[pref].valueOf();
      }
    }
    return preferenceValue;
  },
  /**
   * Set a preference for ZSR branch
   * @param {string} pref
   * @param {string|number|boolean} value
   * @returns boolean
   */
  set: function (pref, value) {
    const preferenceBranch = this.getBranch();

    // if there is already a preference, chance are we don't want to overwrite
    // since we set this up ideally once
    try {
      this.get(pref, true);
    } catch (e) {
      switch (typeof value) {
        case 'boolean':
          return preferenceBranch.setBoolPref(pref, value);
        case 'string':
          return preferenceBranch.setCharPref(pref, value);
        case 'number':
          return preferenceBranch.setIntPref(pref, value);
        default:
          return false;
      }
    }
    return true;
  },
  /**
   * Clear a preference for ZSR branch
   * @param {string} pref
   */
  clear: function (pref) {
    const preferenceBranch = this.getBranch();
    try {
      preferenceBranch.clearUserPref(pref);
    } catch (e) {
      throw new Error(`[ZSR]: Invalid preference ${pref}`);
    }
  },
};


$__zsr.app = {
  /**
   * The overall length of the citation count
   * @private
   */
  __citeCountStrLength: 7,
  /**
   * The string prefix for the citation count
   * @private
   */
  __extraEntryPrefix: 'ZSR',
  /**
   * The string append for the citation count
   * @private
   */
  __extraEntrySeparator: ' \n',
  /**
   * The string for when citation count is empty
   * @private
   */
  __noData: 'NoCitationData',
  /**
   * API endpoint for Google Scholar
   * @private
   */
  __apiEndpoint: 'https://scholar.google.com/',
  /**
   * Initialize our world.
   * @return {void}
   */
  init: ({ id, version, rootURI } = {}) => {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;

    // $__zsr.debugger.info(`Init() Complete! ${this.rootURI}`);
  },

  main: async function () {
    // Global properties are included automatically in Zotero 7
    $__zsr.debugger.info(
      `extensions.zsr.useRandomWait: ${Zotero.Prefs.get(
        'extensions.zsr.useRandomWait',
        true
      )}`
    );
  },

  getActivePane: function () {
    return Zotero.getActiveZoteroPane();
  },

  addToWindow: async function (window) {
    const doc = window.document;

    window.MozXULElement.insertFTLIfNeeded('zsr.ftl');

    const XUL_NS =
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

    // Add menu option
    const menuitem = doc.createElementNS(XUL_NS, 'menuitem');
    menuitem.id = 'zsr-get-count';
    menuitem.classList.add(
      'menuitem-iconic',
      'zotero-menuitem-retrieve-metadata'
    );
    menuitem.setAttribute('label', 'Update scholar rank');
    menuitem.addEventListener('command', async () => {
      await $__zsr.app.updateItemMenuEntries();
    });
    doc.getElementById('zotero-itemmenu').appendChild(menuitem);

    $__zsr.debugger.info(`${doc}`);
    $__zsr.debugger.info(`Option Added to Right Click Menu`);

    // $__zsr.app.registeredDataKey =
    //   await Zotero.ItemTreeManager.registerColumns({
    //     dataKey: 'zsRank',
    //     label: 'Scholar Rank',
    //     pluginID: 'SiriusXT@null.null', // Replace with your plugin ID
    //     dataProvider: (item, dataKey) => {
    //       const fieldExtra = item.getField('callNumber');
    //       if (fieldExtra.startsWith(this.__extraEntryPrefix)) {
    //         return parseInt(
    //           fieldExtra
    //             .match(new RegExp(`${this.__extraEntryPrefix}.{9}`, 'g'))[0]
    //             .split(' ')[1]
    //         );
    //       } else {
    //         return '';
    //       }
    //     },
    //   });
  },

  removeFromWindow: async function (win) {
    const doc = win.document;
    await Zotero.ItemTreeManager.unregisterColumns(
      $__zsr.app.registeredDataKey
    );
    // failsafe
    try {
      doc.querySelector('#zsr-get-count').remove();
    } catch (error) {
      $__zsr.debugger.info(
        'Unable to remove custom column; already cleaned up.'
      );
    }
  },
  addToAllWindows: function () {
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
      if (!win.ZoteroPane) continue;
      this.addToWindow(win);
    }
  },
  removeFromAllWindows: function () {
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
      if (!win.ZoteroPane) continue;
      this.removeFromWindow(win);
    }
  },
  /**
   * Verify is the Zotero item record has a title and creators (otherwise we
   * can't query)
   * @param {ZoteroGenericItem} item
   * @return {boolean}
   */
  hasRequiredFields: function (item) {
    return item.getField('title') !== '' && item.getCreators().length > 0;
  },
  updateCollectionMenuEntry: async function () {
    const zoteroPane = $__zsr.app.getActivePane();
    const window = Zotero.getMainWindow();

    if (!zoteroPane.canEditLibrary()) {
      window.alert($__zsr.localization.string.lackPermissions);
      return;
    }

    const group = zoteroPane.getSelectedGroup();
    if (group) {
      this.updateGroup(zoteroPane.getSelectedGroup());
      return;
    }

    const collection = zoteroPane.getSelectedCollection();
    if (collection) {
      await this.updateCollection(collection);
      return;
    }

    window.alert($__zsr.localization.string.unSupportedEntryType);
    return;
  },
  updateItemMenuEntries: async function () {
    const zoteroPane = $__zsr.app.getActivePane();
    const window = Zotero.getMainWindow();

    if (!zoteroPane.canEditLibrary()) {
      window.alert($__zsr.localization.string.lackPermissions);
      return;
    }
    await this.processItems(zoteroPane.getSelectedItems());
  },
  updateGroup: function () {
    const window = Zotero.getMainWindow();
    window.alert($__zsr.localization.string.unSupportedGroupCollection);
    return;
  },
  updateCollection: async function (collection) {
    await this.processItems(collection.getChildItems());
    const childCollections = collection.getChildCollections();
    for (let idx = 0; idx < childCollections.length; ++idx) {
      this.updateCollection(childCollections[idx]);
    }
  },

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  findMatchInCCF: function (ccf, str) {
    let maxlen = 2;
    let fenqu = "";

    for (let i = 0; i < ccf.length; i++) {
      let entry = ccf[i];

      let processedStr = str.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
      let processedJournal = entry.Journal.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
      if (entry.Journal.indexOf("Computer Vision and Pattern Recognition")>=0) {
        processedJournal = "Computer Vision and Pattern Recognition".toLowerCase().replace(/\s+/g, ' ').trim();
      }
      const matchIndex = processedStr.indexOf(processedJournal);
      if (entry.Journal && matchIndex !== -1) {
        // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 
        // https://github.com/SiriusXT/Zotero-Scholar-Rank/issues/26
        // 获取匹配字符串前后的字符
        const prevChar = matchIndex > 0 ? processedStr[matchIndex - 1
        ] : null;
        const nextChar = matchIndex + processedJournal.length < processedStr.length ? processedStr[matchIndex + processedJournal.length
        ] : null;

        // 检查前后字符是否都是空格
        const isPrevCharSpace = prevChar === ' ' || prevChar === null;
        const isNextCharSpace = nextChar === ' ' || nextChar === null;
        // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

        if (entry.Journal.length >= maxlen && isPrevCharSpace && isNextCharSpace) {
          maxlen = entry.Journal.length;
          fenqu = entry.fenqu;
        }
      }
    }
    /////////////////
    // maxlen = 2; abbr: Performance 
    for (let i = 0; i < ccf.length; i++) {
      if (true) {
        let entry = ccf[i
        ];
        let abbr = entry.Abbr;
        // 查找 entry.Abbr 在 str 中的匹配位置
        const matchIndex = str.indexOf(abbr);
        // 如果找到了匹配位置并且长度大于等于当前最大长度
        if (matchIndex !== -1 && abbr.length >= maxlen) {
          // 检查前一个和后一个字符是否是非字母字符或边界
          const prevChar = matchIndex > 0 ? str[matchIndex - 1] : null;
          const nextChar = matchIndex + abbr.length < str.length ? str[matchIndex + abbr.length] : null;

          const isPrevCharNonLetter = prevChar === null || !/[a-zA-Z]/.test(prevChar);
          const isNextCharNonLetter = nextChar === null || !/[a-zA-Z]/.test(nextChar);


          // 只有在前后字符都不是字母时，才更新 maxlen 和 fenqu
          if (isPrevCharNonLetter && isNextCharNonLetter) {
            maxlen = abbr.length;
            fenqu = entry.fenqu;
          }
        }
      }
    }
    return fenqu;
  },

  findMatchInJCR: function (journals, journalName) {
    let found = journals.find(journal => journal.Journal.toLowerCase() === journalName.toLowerCase());
    return found ? `${found.IF}|${found.Quartile}` : "";
  },

  findMatchInZKY: function (journals, journalName) {
    let found = journals.find(journal => journal.Journal.toLowerCase() === journalName.toLowerCase());
    if (found) {
      return found.Top === "Y" ? `${found.fenqu}区TOP` : `${found.fenqu}区`;
    }
    return "";
  },

  findMatchInCCFCN: function (journals, journalName) {
    let found = journals.find(journal => journal.CNJournal === journalName);
    if (!found) {
      found = journals.find(journal => journal.Journal === journalName);
    }
    return found ? found.fenqu : "";
  },

  findMatchInGLL: function (journals, journalName) {
    let found = journals.find(journal => journal.Journal === journalName);
    return found ? found.fenqu : "";
  },

  getRank: async function (item) {
    if (item.itemType === 'journalArticle') {
      if (item.getField('publicationTitle')) {
        let ccf_result = this.findMatchInCCF(__ranks._ccf, item.getField('publicationTitle'));
        let jcr_result = this.findMatchInJCR(__ranks._jcr, item.getField('publicationTitle'));
        let zky_result = this.findMatchInZKY(__ranks._zky, item.getField('publicationTitle'));
        let ccfcn_result = this.findMatchInCCFCN(__ranks._ccfcn, item.getField('publicationTitle'));
        let gll_result = this.findMatchInGLL(__ranks._gll, item.getField('publicationTitle'));

        let result = [ccf_result, jcr_result, zky_result, ccfcn_result, gll_result]
          .filter(res => res !== "")
          .join("|");

        if (!result) {
          if (item.getField('publicationTitle').includes("arXiv")) {
            result = "arXiv";
          } else {
            result = "Not Found";
          }
        }
        item.setField('callNumber', result);
        await item.saveTx();
      } else {
        item.setField('callNumber', "Invalid Title");
        await item.saveTx();
      }
    } else if (item.itemType === 'conferencePaper') {
      let result = this.findMatchInCCF(__ranks._ccf, item.getField('proceedingsTitle')) || this.findMatchInCCF(__ranks._ccf, item.getField('conferenceName')) || "Not Found";
      item.setField('callNumber', result);
      await item.saveTx();
      // cb(item, result);
    } else if (item.itemType === 'preprint') {
      item.setField('callNumber', item.getField('repository'));
      await item.saveTx();
    } else if (item.itemType === 'thesis') {
      item.setField('callNumber', item.getField('university'));
      await item.saveTx();
    }
  },


  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<



  /**
   * fatch and process data and update the selected entries from Zotero
   * @param {ZoteroGenericItem[]} items
   */
  processItems: async function (items) {
    const useQueue = $__zsr.preferences.get(
      $__zsr.preferences.keys.USE_RANDOM_WAIT
    );
    let queueMinWaitMs;
    let queueMaxWaitMs;

    if (useQueue) {
      queueMinWaitMs = $__zsr.preferences.get(
        $__zsr.preferences.keys.RANDOM_WAIT_MIN_MS
      );
      queueMaxWaitMs = $__zsr.preferences.get(
        $__zsr.preferences.keys.RANDOM_WAIT_MAX_MS
      );
    }

    /**
     * @param {number} index
     * @param {ZoteroGenericItem} item
     */
    for (const [index, item] of items.entries()) {
      if (!this.hasRequiredFields(item)) {
        $__zsr.debugger.warn(
          `skipping item '${item.getField(
            'title'
          )}': empty title or missing creator information'`
        );
      } else {
        //@ss
        this.updateItem(item);

      }
    }
  },
  /**
   * update a record with the citation data
   * @param {ZoteroGenericItem} item
   * @param {number} citeCount
   */
  updateItem: function (item) {
    //@ss
    this.getRank(item)

  },

};

/**
 * The handlers are what bind to the actions within the overlay XUL
 */
$__zsr.handlers = {
  updateCollectionMenuEntry: async function () {
    await $__zsr.app.updateCollectionMenuEntry();
  },
  updateItemMenuEntries: async function () {
    await $__zsr.app.updateItemMenuEntries();
  },
};

// For testing only
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    $__zsr,
  };
}
