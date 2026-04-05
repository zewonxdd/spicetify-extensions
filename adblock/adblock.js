"use strict";

const loadWebpack = () => {
    try {
        const require = window.webpackChunkclient_web.push([[Symbol()], {}, (re) => re]);
        const cache = Object.keys(require.m).map(id => require(id));
        const modules = cache
            .filter(module => typeof module === "object")
            .flatMap(module => {
                try {
                    return Object.values(module);
                } catch (e) {
                    return [];
                }
            });
        const webpackFactories = new Set(Object.values(require.m));
        const functionModules = modules.flatMap(module =>
            typeof module === "function"
                ? [module]
                : typeof module === "object" && module
                    ? Object.values(module).filter(v => typeof v === "function" && !webpackFactories.has(v))
                    : [],
        );

        return { cache: cache, functionModules: functionModules };
    } catch (error) {
        console.error("adblockify: Failed to load webpack", error);
        return { cache: [], functionModules: [] };
    }
};

const SETTINGS_SERVICE_IDS = [
    "spotify.ads.esperanto.settings.proto.Settings",
    "spotify.ads.esperanto.proto.Settings"
];

const SLOTS_SERVICE_IDS = [
    "spotify.ads.esperanto.slots.proto.Slots",
    "spotify.ads.esperanto.proto.Slots"
];

const TESTING_SERVICE_IDS = [
    "spotify.ads.esperanto.testing.proto.Testing",
    "spotify.ads.esperanto.proto.Testing"
];

const findByServiceId = (functionModules, serviceIds) => {
    return functionModules.find(m => m && serviceIds.includes(m.SERVICE_ID)) || null;
};

const getSettingsClient = (cache, functionModules, transport) => {
    try {
        const settingsClient = cache.find(m => m && m.settingsClient);
        if (settingsClient) return settingsClient.settingsClient;

        const Settings = findByServiceId(functionModules, SETTINGS_SERVICE_IDS);
        if (Settings) return new Settings(transport);

        return null;
    } catch (error) {
        console.error("adblockify: Failed to get ads settings client", error);
        return null;
    }
};

const getSlotsClient = (functionModules, transport) => {
    try {
        const Slots = findByServiceId(functionModules, SLOTS_SERVICE_IDS);
        if (Slots) return new Slots(transport);
        return null;
    } catch (error) {
        console.error("adblockify: Failed to get slots client", error);
        return null;
    }
};

const getTestingClient = (functionModules, transport) => {
    try {
        const Testing = findByServiceId(functionModules, TESTING_SERVICE_IDS);
        if (Testing) return new Testing(transport);
        return null;
    } catch (error) {
        console.error("adblockify: Failed to get testing client", error);
        return null;
    }
};

const retryMap = new Map();
const MAX_RETRIES = 5;

const retryCounter = (slotId, action) => {
    if (!retryMap.has(slotId)) retryMap.set(slotId, 0);
    if (action === "increment") retryMap.set(slotId, retryMap.get(slotId) + 1);
    else if (action === "clear") retryMap.delete(slotId);
    else if (action === "get") return retryMap.get(slotId) || 0;
};

// CSS class selectors for hiding ad-related DOM elements
var AD_SELECTORS = [
    ".Mvhjv8IKLGjQx94MVOgP", ".sl_aPp6GDg05ItSfmsS7", ".nHCJskDZVlmDhNNS9Ixv", ".utUDWsORU96S7boXm2Aq",
    ".cpBP3znf6dhHLA2dywjy", ".G7JYBeU1c2QawLyFs5VK", ".vYl1kgf1_R18FCmHgdw2", ".vZkc6VwrFz0EjVBuHGmx",
    ".iVAZDcTm1XGjxwKlQisz", "._I_1HMbDnNlNAaViEnbp", ".xXj7eFQ8SoDKYXy6L3E1", ".F68SsPm8lZFktQ1lWsQz",
    ".MnW5SczTcbdFHxLZ_Z8j", ".WiPggcPDzbwGxoxwLWFf", ".ReyA3uE3K7oEz7PTTnAn", ".x8e0kqJPS0bM4dVK7ESH",
    ".gZ2Nla3mdRREDCwybK6X", ".SChMe0Tert7lmc5jqH01", ".AwF4EfqLOIJ2xO7CjHoX", ".UlkNeRDFoia4UDWtrOr4",
    ".k_RKSQxa2u5_6KmcOoSw", "._mWmycP_WIvMNQdKoAFb", ".O3UuqEx6ibrxyOJIdpdg", ".akCwgJVf4B4ep6KYwrk5",
    ".bIA4qeTh_LSwQJuVxDzl", ".ajr9pah2nj_5cXrAofU_", ".gvn0k6QI7Yl_A0u46hKn", ".obTnuSx7ZKIIY1_fwJhe",
    ".IiLMLyxs074DwmEH4x5b", ".RJjM91y1EBycwhT_wH59", ".mxn5B5ceO2ksvMlI1bYz", ".l8wtkGVi89_AsA3nXDSR",
    ".Th1XPPdXMnxNCDrYsnwb", ".SJMBltbXfqUiByDAkUN_", ".Nayn_JfAUsSO0EFapLuY", ".YqlFpeC9yMVhGmd84Gdo",
    ".HksuyUyj1n3aTnB4nHLd", ".DT8FJnRKoRVWo77CPQbQ", "._Cq69xKZBtHaaeMZXIdk",
    ".main-leaderboardComponent-container", ".sponsor-container",
    "a.link-subtle.main-navBar-navBarLink.GKnnhbExo0U9l7Jz2rdc",
    ".main-topBar-UpgradeButton",
    '.main-contextMenu-menuItem a[href^="https://www.spotify.com/premium/"]',
    'div[data-testid*="hpto"]', 'div[data-testid="test-ref-div"]',
    '.main-trackCreditsModal-mainSection [class*="Ads"]',
    '.nav-alt [href="/premium"]', 'div[class*="AdSlot"]'
];

(async function adblockify() {
    await new Promise(function (res) { Spicetify.Events.platformLoaded.on(res); });
    await new Promise(function (res) { Spicetify.Events.webpackLoaded.on(res); });

    var webpackCache = loadWebpack();
    var Platform = Spicetify.Platform;
    var Locale = Spicetify.Locale;
    var AdManagers = Platform.AdManagers;

    if (!AdManagers || !AdManagers.audio || Object.keys(AdManagers).length === 0) {
        setTimeout(adblockify, 100);
        return;
    }

    var audio = AdManagers.audio;
    var UserAPI = Platform.UserAPI;
    var productState = (UserAPI && UserAPI._product_state) ||
        (UserAPI && UserAPI._product_state_service) ||
        (Platform.ProductStateAPI && Platform.ProductStateAPI.productStateApi);
    var version = Spicetify.Platform.version.split(".").map(function (i) { return parseInt(i); });

    if (!Spicetify.CosmosAsync) {
        setTimeout(adblockify, 100);
        return;
    }
    var CosmosAsync = Spicetify.CosmosAsync;

    // --- Slots ---
    var slots = [];
    var slotsClient = getSlotsClient(webpackCache.functionModules, productState.transport);
    if (slotsClient) {
        var result = await slotsClient.getSlots();
        slots = result.adSlots || [];
    } else {
        try {
            slots = await CosmosAsync.get("sp://ads/v1/slots");
        } catch (error) {
            setTimeout(adblockify, 100);
            return;
        }
    }

    // --- Hide ad-like DOM elements ---
    var hideAdLikeElements = function () {
        if (document.querySelector("style.adblockify")) return; // prevent duplicate injection

        var upgradeText = Locale.get("upgrade.tooltip.title");
        var allSelectors = AD_SELECTORS.concat([
            'button[title="' + upgradeText + '"]',
            'button[aria-label="' + upgradeText + '"]'
        ]);

        var css = document.createElement("style");
        css.className = "adblockify";
        css.textContent = allSelectors.join(", ") +
            " { display: none !important; height: 0 !important; padding: 0 !important; margin: 0 !important; overflow: hidden !important; }";
        document.head.appendChild(css);
    };

    // --- Override product state to premium ---
    var disableAds = async function () {
        try {
            await productState.putOverridesValues({
                pairs: { ads: "0", catalogue: "premium", product: "premium", type: "premium" }
            });
        } catch (error) {
            console.error("adblockify: disableAds failed", error);
        }
    };

    // --- Disable all ad managers ---
    var configureAdManagers = async function () {
        try {
            if (!AdManagers) return;
            var billboard = AdManagers.billboard;
            var leaderboard = AdManagers.leaderboard;
            var sponsoredPlaylist = AdManagers.sponsoredPlaylist;
            var testingClient = getTestingClient(webpackCache.functionModules, productState.transport);

            if (testingClient) {
                testingClient.addPlaytime({ seconds: -100000000000 });
            } else {
                await CosmosAsync.post("sp://ads/v1/testing/playtime", { value: -100000000000 });
            }

            if (audio && typeof audio.disable === "function") await audio.disable();
            if (audio) audio.isNewAdsNpvEnabled = false;

            if (billboard && typeof billboard.disable === "function") await billboard.disable();
            if (leaderboard && typeof leaderboard.disableLeaderboard === "function") await leaderboard.disableLeaderboard();
            if (sponsoredPlaylist && typeof sponsoredPlaylist.disable === "function") await sponsoredPlaylist.disable();

            if (AdManagers.inStreamApi && typeof AdManagers.inStreamApi.disable === "function") {
                await AdManagers.inStreamApi.disable();
            }
            if (AdManagers.vto) {
                if (AdManagers.vto.manager && typeof AdManagers.vto.manager.disable === "function") {
                    await AdManagers.vto.manager.disable();
                }
                AdManagers.vto.isNewAdsNpvEnabled = false;
            }

            setTimeout(disableAds, 100);
        } catch (error) {
            console.error("adblockify: configureAdManagers failed", error);
        }
    };

    // --- Slot settings override ---
    var updateSlotSettings = async function (slotId) {
        try {
            var settingsClient = getSettingsClient(webpackCache.cache, webpackCache.functionModules, productState.transport);
            if (!settingsClient) return;
            var timeInterval = (version[0] === 1 && version[1] >= 2 && version[2] >= 82) ? BigInt(0) : "0";
            await settingsClient.updateAdServerEndpoint({ slotIds: [slotId], url: "http://localhost/no/thanks" });
            await settingsClient.updateStreamTimeInterval({ slotId: slotId, timeInterval: timeInterval });
            await settingsClient.updateSlotEnabled({ slotId: slotId, enabled: false });
            await settingsClient.updateDisplayTimeInterval({ slotId: slotId, timeInterval: timeInterval });
        } catch (error) {
            console.error("adblockify: updateSlotSettings failed for slot " + slotId, error);
        }
    };

    // --- Handle individual ad slot events ---
    var handleAdSlot = function (data) {
        var slotId = data && data.adSlotEvent && data.adSlotEvent.slotId;
        if (!slotId) return;

        try {
            var adsCoreConnector = audio && audio.inStreamApi && audio.inStreamApi.adsCoreConnector;
            if (adsCoreConnector && typeof adsCoreConnector.clearSlot === "function") {
                adsCoreConnector.clearSlot(slotId);
            }
            var client = getSlotsClient(webpackCache.functionModules, productState.transport);
            if (client) client.clearAllAds({ slotId: slotId });
            updateSlotSettings(slotId);
        } catch (error) {
            console.error("adblockify: handleAdSlot failed for slot " + slotId + ". Retrying...", error);
            retryCounter(slotId, "increment");
            if (retryCounter(slotId, "get") > MAX_RETRIES) {
                console.error("adblockify: handleAdSlot gave up after " + MAX_RETRIES + " retries for slot " + slotId);
                retryCounter(slotId, "clear");
                return;
            }
            setTimeout(handleAdSlot, 1000, data);
        }
        configureAdManagers();
    };

    // --- Subscribe to slot events ---
    var subToSlot = function (slotId) {
        try {
            var connector = audio && audio.inStreamApi && audio.inStreamApi.adsCoreConnector;
            if (connector && typeof connector.subscribeToSlot === "function") {
                connector.subscribeToSlot(slotId, handleAdSlot);
            }
        } catch (error) {
            console.error("adblockify: subToSlot failed for slot " + slotId, error);
        }
    };

    // --- Bind to all discovered slots ---
    var bindToSlots = function () {
        for (var i = 0; i < slots.length; i++) {
            var slotId = slots[i].slotId || slots[i].slot_id;
            if (slotId) {
                subToSlot(slotId);
                setTimeout(handleAdSlot, 50, { adSlotEvent: { slotId: slotId } });
            }
        }
    };

    // --- Periodically re-apply slot settings ---
    var intervalUpdateSlotSettings = function () {
        for (var i = 0; i < slots.length; i++) {
            var slotId = slots[i].slotId || slots[i].slot_id;
            if (slotId) updateSlotSettings(slotId);
        }
    };

    // --- Enable experimental feature overrides ---
    var enableExperimentalFeatures = async function () {
        try {
            var expFeatures = JSON.parse(localStorage.getItem("spicetify-exp-features") || "{}");
            var featureMap = {
                enableEsperantoMigration: true,
                enableInAppMessaging: false,
                hideUpgradeCTA: true,
                enablePremiumUserForMiniPlayer: true
            };

            var keys = Object.keys(featureMap);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                if (expFeatures[key] && typeof expFeatures[key].value !== "undefined") {
                    expFeatures[key].value = featureMap[key];
                }
            }
            localStorage.setItem("spicetify-exp-features", JSON.stringify(expFeatures));

            if (Spicetify.RemoteConfigResolver) {
                var map = Spicetify.createInternalMap(featureMap);
                Spicetify.RemoteConfigResolver.value.setOverrides(map);
            } else if (Spicetify.Platform && Spicetify.Platform.RemoteConfigDebugAPI) {
                var api = Spicetify.Platform.RemoteConfigDebugAPI;
                for (var j = 0; j < keys.length; j++) {
                    await api.setOverride(
                        { source: "web", type: "boolean", name: keys[j] },
                        featureMap[keys[j]]
                    );
                }
            }
        } catch (error) {
            console.error("adblockify: enableExperimentalFeatures failed", error);
        }
    };

    // --- Execute ---
    bindToSlots();
    hideAdLikeElements();
    configureAdManagers();

    if (productState && typeof productState.subValues === "function") {
        productState.subValues(
            { keys: ["ads", "catalogue", "product", "type"] },
            function () { configureAdManagers(); }
        );
    }

    enableExperimentalFeatures();
    setTimeout(enableExperimentalFeatures, 3000);
    setTimeout(intervalUpdateSlotSettings, 5000);
})();
