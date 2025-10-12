// Kalkulator Petrol MAMTJ6 - Versi 3.1

document.addEventListener('DOMContentLoaded', () => {
    // --- Tab Logic ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // --- CALCULATOR 1: KALKULATOR PETROL ---
    const petrolFormFull = document.getElementById('petrol-form-full');
    const modeRmBtn = document.getElementById('mode-rm');
    const modeLiterBtn = document.getElementById('mode-liter');
    const userInputLabel = document.getElementById('user-input-label');
    const userInput = document.getElementById('user-input');
    const resetBtnFull = document.getElementById('reset-btn-full');
    const oldPriceInput = document.getElementById('old-price');
    const subsidyPriceInput = document.getElementById('subsidy-price');
    const noSubsidyPriceInput = document.getElementById('nosubsidy-price');
    const fullCalcResults = document.getElementById('full-calc-results');
    const fullResultsGrid = document.getElementById('full-results-grid');
    const resultLiters = document.getElementById('result-liters');
    const resultTotal = document.getElementById('result-total');
    const savingVsOld = document.getElementById('saving-vs-old');
    const savingVsNoSubsidy = document.getElementById('saving-vs-nosubsidy');
    const dynamicExplanation = document.getElementById('dynamic-explanation');
    let currentMode = 'RM';

    const switchModeFull = (newMode) => {
        currentMode = newMode;
        userInput.value = '';
        userInputLabel.textContent = (newMode === 'RM') ? 'Jumlah bayaran (RM)' : 'Jumlah liter (L)';
        if (newMode === 'RM') { modeRmBtn.classList.add('active'); modeLiterBtn.classList.remove('active'); } 
        else { modeLiterBtn.classList.add('active'); modeRmBtn.classList.remove('active'); }
        fullCalcResults.classList.add('hidden');
    };
    const resetCalculatorFull = () => {
        petrolFormFull.reset();
        userInput.value = '';
        oldPriceInput.value = '2.05'; subsidyPriceInput.value = '1.99'; noSubsidyPriceInput.value = '2.60';
        switchModeFull('RM');
        [fullCalcResults, dynamicExplanation].forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('fade-in');
        });
    };
    const calculateFull = (event) => {
        event.preventDefault();
        const oldPrice = parseFloat(oldPriceInput.value);
        const subsidyPrice = parseFloat(subsidyPriceInput.value);
        const noSubsidyPrice = parseFloat(noSubsidyPriceInput.value);
        const userValue = parseFloat(userInput.value);
        if ([oldPrice, subsidyPrice, noSubsidyPrice, userValue].some(isNaN) || userValue <= 0) { alert('Sila masukkan semua nilai yang sah.'); return; }
        
        let totalLiters, totalCost, explanationHTML;

        if (currentMode === 'RM') {
            totalCost = userValue;
            totalLiters = totalCost / subsidyPrice;
            const litersOld = totalCost / oldPrice;
            const litersNoSubsidy = totalCost / noSubsidyPrice;
            explanationHTML = `<div class="dynamic-explanation-title">Dengan jumlah wang yang sama <strong>(RM${totalCost.toFixed(2)})</strong>:</div>
                <div class="comparison-line">Pada harga tanpa subsidi (RM${noSubsidyPrice.toFixed(2)}/L), anda akan memperoleh <strong>${litersNoSubsidy.toFixed(2)} liter</strong></div>
                <div class="comparison-line">Pada harga petrol lama (RM${oldPrice.toFixed(2)}/L), anda akan memperoleh <strong>${litersOld.toFixed(2)} liter</strong></div>`;
            fullResultsGrid.classList.remove('mode-liter-layout');
        } else { // Mode Liter
            totalLiters = userValue;
            totalCost = totalLiters * subsidyPrice;
            const costOld = totalLiters * oldPrice;
            const costNoSubsidy = totalLiters * noSubsidyPrice;
            explanationHTML = `<div class="dynamic-explanation-title">Untuk mendapatkan jumlah petrol yang sama <strong>(${totalLiters.toFixed(2)} liter)</strong>:</div>
                <div class="comparison-line">Pada harga petrol lama (RM${oldPrice.toFixed(2)}/L), anda perlu membayar <strong>RM${costOld.toFixed(2)}</strong></div>
                <div class="comparison-line">Pada harga tanpa subsidi (RM${noSubsidyPrice.toFixed(2)}/L), anda perlu membayar <strong>RM${costNoSubsidy.toFixed(2)}</strong></div>`;
            fullResultsGrid.classList.add('mode-liter-layout');
        }

        const savingOld = (oldPrice * totalLiters) - totalCost;
        const savingNoSubsidy = (noSubsidyPrice * totalLiters) - totalCost;

        resultLiters.innerHTML = `${totalLiters.toFixed(2)} <span class="unit">L</span>`;
        resultTotal.textContent = `RM${totalCost.toFixed(2)}`;
        savingVsOld.textContent = `RM${savingOld.toFixed(2)}`;
        savingVsNoSubsidy.textContent = `RM${savingNoSubsidy.toFixed(2)}`;
        dynamicExplanation.innerHTML = explanationHTML;
        
        [fullCalcResults, dynamicExplanation].forEach(el => {
            el.classList.remove('hidden');
            el.classList.add('fade-in');
        });
    };
    modeRmBtn.addEventListener('click', () => switchModeFull('RM'));
    modeLiterBtn.addEventListener('click', () => switchModeFull('Liter'));
    petrolFormFull.addEventListener('submit', calculateFull);
    resetBtnFull.addEventListener('click', resetCalculatorFull);

    // --- CALCULATOR 2: ISI 'FULL TANK' ---
    const petrolFormTopUp = document.getElementById('petrol-form-topup');
    const modeSubsidiBtn = document.getElementById('mode-subsidi');
    const modeTanpaSubsidiBtn = document.getElementById('mode-tanpa-subsidi');
    const resetBtnTopUp = document.getElementById('reset-btn-topup');
    const tankCapacityInput = document.getElementById('tank-capacity');
    const totalBarsInput = document.getElementById('total-bars');
    const currentBarsInput = document.getElementById('current-bars');
    const fuelGaugeContainer = document.getElementById('fuel-gauge-container');
    const gaugeVisual = document.getElementById('fuel-gauge-visual');
    const scrollInstruction = document.getElementById('scroll-instruction');
    const topupCalcResults = document.getElementById('topup-calc-results');
    const topupCostItem = document.getElementById('topup-cost-item');
    const topupLitersItem = document.getElementById('topup-liters-item');
    const topupPumpCostItem = document.getElementById('topup-pump-cost-item');
    const topupSavingVsOldItem = document.getElementById('topup-saving-vs-old-item');
    const topupSavingVsNoSubsidyItem = document.getElementById('topup-saving-vs-nosubsidy-item');
    const topupCostLabel = document.getElementById('topup-cost-label');
    const topupCostValue = document.getElementById('topup-cost');
    const topupLitersValue = document.getElementById('topup-liters');
    const topupPumpCostValue = document.getElementById('topup-pump-cost');
    const topupSavingOldValue = document.getElementById('topup-saving-old-value');
    const topupSavingNosubsidyValue = document.getElementById('topup-saving-nosubsidy-value');
    const OLD_PRICE_REF = 2.05;
    const SUBSIDY_PRICE = 1.99;
    const PUMP_PRICE = 2.60;
    let topUpMode = 'subsidi';

    const switchModeTopUp = (newMode) => {
        topUpMode = newMode;
        if (newMode === 'subsidi') {
            modeSubsidiBtn.classList.add('active'); modeTanpaSubsidiBtn.classList.remove('active');
        } else {
            modeTanpaSubsidiBtn.classList.add('active'); modeSubsidiBtn.classList.remove('active');
        }
        [fuelGaugeContainer, topupCalcResults].forEach(el => el.classList.add('hidden'));
    };
    const resetCalculatorTopUp = () => {
        petrolFormTopUp.reset();
        switchModeTopUp('subsidi');
        [fuelGaugeContainer, topupCalcResults, scrollInstruction].forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('fade-in');
        });
    };
    const calculateTopUp = (event) => {
        event.preventDefault();
        const tankCapacity = parseFloat(tankCapacityInput.value); const totalBars = parseInt(totalBarsInput.value); const currentBars = parseInt(currentBarsInput.value);
        if (isNaN(tankCapacity) || isNaN(totalBars) || isNaN(currentBars) || tankCapacity <= 0 || totalBars <= 0) { alert('Sila masukkan semua nilai yang sah.'); return; }
        if (currentBars >= totalBars) { alert('Baki bar semasa mesti kurang daripada jumlah bar penuh untuk pengiraan.'); return; }
        const basePrice = (topUpMode === 'subsidi') ? SUBSIDY_PRICE : PUMP_PRICE;
        const totalLitersNeeded = (tankCapacity / totalBars) * (totalBars - currentBars);
        const totalCost = totalLitersNeeded * basePrice;
        topupLitersValue.innerHTML = `${totalLitersNeeded.toFixed(2)} <span class="unit">L</span>`;
        topupCostValue.textContent = `RM${totalCost.toFixed(2)}`;
        [topupCostItem, topupLitersItem, topupPumpCostItem, topupSavingVsOldItem, topupSavingVsNoSubsidyItem].forEach(el => el.classList.remove('hidden', 'full-width', 'result-item-primary'));
        if (topUpMode === 'subsidi') {
            topupCostLabel.textContent = 'Harga Subsidi (Bayar)';
            topupCostItem.classList.add('full-width', 'result-item-primary');
            topupCostItem.style.order = 1; topupLitersItem.style.order = 2; topupPumpCostItem.style.order = 3;
            topupSavingVsOldItem.style.order = 4; topupSavingVsNoSubsidyItem.style.order = 5;
            const totalPumpCost = totalLitersNeeded * PUMP_PRICE;
            const savingOld = (OLD_PRICE_REF - SUBSIDY_PRICE) * totalLitersNeeded;
            const savingNoSubsidy = (PUMP_PRICE - SUBSIDY_PRICE) * totalLitersNeeded;
            topupPumpCostValue.textContent = `RM${totalPumpCost.toFixed(2)}`;
            topupSavingOldValue.textContent = `RM${savingOld.toFixed(2)}`;
            topupSavingNosubsidyValue.textContent = `RM${savingNoSubsidy.toFixed(2)}`;
        } else {
            topupCostLabel.textContent = 'Harga (Perlu Bayar)';
            topupCostItem.classList.add('full-width', 'result-item-primary');
            topupLitersItem.classList.add('full-width');
            topupCostItem.style.order = 1; topupLitersItem.style.order = 2;
            [topupPumpCostItem, topupSavingVsOldItem, topupSavingVsNoSubsidyItem].forEach(el => el.classList.add('hidden'));
        }
        [fuelGaugeContainer, topupCalcResults, scrollInstruction].forEach(el => {
            el.classList.remove('hidden'); el.classList.add('fade-in');
        });
        gaugeVisual.innerHTML = '';
        for (let i = 1; i <= totalBars; i++) {
            const wrapper = document.createElement('div'); wrapper.className = 'bar-wrapper'; wrapper.style.animationDelay = `${i * 0.05}s`;
            const label = document.createElement('div'); label.className = 'bar-label'; label.textContent = `Bar ${i}`;
            const barDiv = document.createElement('div'); barDiv.classList.add('gauge-bar');
            if (i <= currentBars) { barDiv.classList.add('current'); } else { barDiv.classList.add('needed'); }
            const cumulativeLiters = (tankCapacity / totalBars) * i;
            const cumulativeCost = cumulativeLiters * basePrice;
            barDiv.innerHTML = `<span>${cumulativeLiters.toFixed(2)} L</span><span>RM${cumulativeCost.toFixed(2)}</span>`;
            wrapper.appendChild(label); wrapper.appendChild(barDiv); gaugeVisual.appendChild(wrapper);
        }
    };
    modeSubsidiBtn.addEventListener('click', () => switchModeTopUp('subsidi'));
    modeTanpaSubsidiBtn.addEventListener('click', () => switchModeTopUp('tanpa-subsidi'));
    petrolFormTopUp.addEventListener('submit', calculateTopUp);
    resetBtnTopUp.addEventListener('click', resetCalculatorTopUp);
});
