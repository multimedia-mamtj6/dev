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
    // Version Toggle
    const versionToggleBtnComplete = document.getElementById('version-toggle-btn-complete');
    const versionToggleBtnSimple = document.getElementById('version-toggle-btn-simple');
    const completeVersionContainer = document.getElementById('complete-version-container');
    const simpleVersionContainer = document.getElementById('simple-version-container');

    const toggleVersion = () => {
        const isComplete = !completeVersionContainer.classList.contains('hidden');
        if (isComplete) {
            completeVersionContainer.classList.add('hidden');
            simpleVersionContainer.classList.remove('hidden');
        } else {
            simpleVersionContainer.classList.add('hidden');
            completeVersionContainer.classList.remove('hidden');
        }
        resetCalculatorFull();
        resetCalculatorSimple();
    };
    versionToggleBtnComplete.addEventListener('click', toggleVersion);
    versionToggleBtnSimple.addEventListener('click', toggleVersion);

    // --- Complete Version ---
    const petrolFormFull = document.getElementById('petrol-form-full');
    const modeRmBtn = document.getElementById('mode-rm');
    const modeLiterBtn = document.getElementById('mode-liter');
    const userInputLabel = document.getElementById('user-input-label');
    const userInput = document.getElementById('user-input');
    const resetBtnFull = document.getElementById('reset-btn-full');
    const priceOptionSubsidy = document.getElementById('price-option-subsidy');
    const oldPriceInput = document.getElementById('old-price');
    const subsidyPriceInput = document.getElementById('subsidy-price');
    const noSubsidyPriceInput = document.getElementById('nosubsidy-price');
    const fullCalcResults = document.getElementById('full-calc-results');
    const resultLitersItem = document.getElementById('result-liters-item');
    const resultTotalItem = document.getElementById('result-total-item');
    const comparison1Item = document.getElementById('comparison-1-item');
    const comparison2Item = document.getElementById('comparison-2-item');
    const resultLitersValue = document.getElementById('result-liters-value');
    const resultTotalValue = document.getElementById('result-total-value');
    const resultTotalSubtext = document.getElementById('result-total-subtext');
    const comparison1Label = document.getElementById('comparison-1-label');
    const comparison1Value = document.getElementById('comparison-1-value');
    const comparison2Label = document.getElementById('comparison-2-label');
    const comparison2Value = document.getElementById('comparison-2-value');
    const fullCalcNote = document.getElementById('full-calc-note');
    let currentMode = 'RM';

    const switchModeFull = (newMode) => {
        currentMode = newMode;
        userInput.value = '';
        userInput.step = newMode === 'Liter' ? '0.001' : '0.01';
        userInputLabel.textContent = (newMode === 'RM') ? 'Jumlah bayaran (RM)' : 'Jumlah liter (L)';
        modeRmBtn.classList.toggle('active', newMode === 'RM');
        modeLiterBtn.classList.toggle('active', newMode === 'Liter');
        fullCalcResults.classList.add('hidden');
    };
    const resetCalculatorFull = () => {
        petrolFormFull.reset();
        userInput.value = '';
        oldPriceInput.value = '2.05'; subsidyPriceInput.value = '1.99'; noSubsidyPriceInput.value = '2.60';
        priceOptionSubsidy.checked = true;
        switchModeFull('RM');
        fullCalcResults.classList.remove('fade-in');
    };
    const calculateFull = (event) => {
        event.preventDefault();
        const oldPrice = parseFloat(oldPriceInput.value); const subsidyPrice = parseFloat(subsidyPriceInput.value); const noSubsidyPrice = parseFloat(noSubsidyPriceInput.value); const userValue = parseFloat(userInput.value);
        if ([oldPrice, subsidyPrice, noSubsidyPrice, userValue].some(isNaN) || userValue <= 0) { alert('Sila masukkan semua nilai yang sah.'); return; }
        const isSubsidyMode = priceOptionSubsidy.checked;
        const basePrice = isSubsidyMode ? subsidyPrice : noSubsidyPrice;
        let totalLiters, totalCost, noteContent;
        [resultLitersItem, resultTotalItem].forEach(el => el.classList.remove('result-item-primary'));
        comparison1Item.style.order = 3; comparison2Item.style.order = 4;
        if (currentMode === 'RM') {
            totalCost = userValue; totalLiters = totalCost / basePrice;
            resultLitersItem.classList.add('result-item-primary');
            resultLitersItem.style.order = 1; resultTotalItem.style.order = 2;
            if (isSubsidyMode) {
                const litersNoSubsidy = totalCost / noSubsidyPrice; const litersOld = totalCost / oldPrice;
                noteContent = `Dengan jumlah wang yang sama (RM${totalCost.toFixed(2)}):<ul><li>Pada harga di pam (RM${noSubsidyPrice.toFixed(2)}/L), anda akan memperoleh <strong>${litersNoSubsidy.toFixed(3)} L</strong>.</li><li>Pada harga petrol lama (RM${oldPrice.toFixed(2)}/L), anda akan memperoleh <strong>${litersOld.toFixed(3)} L</strong>.</li></ul>`;
            } else {
                resultLitersItem.classList.add('result-item-primary');
                resultTotalItem.style.order = 1; resultLitersItem.style.order = 2;
                const litersSubsidy = totalCost / subsidyPrice;
                noteContent = `Dengan jumlah wang yang sama (RM${totalCost.toFixed(2)}):<ul><li>Pada harga bersubsidi (RM${subsidyPrice.toFixed(2)}/L), anda sebenarnya boleh memperoleh <strong>${litersSubsidy.toFixed(3)} L</strong>.</li></ul>`;
            }
        } else {
            totalLiters = userValue; totalCost = totalLiters * basePrice;
            resultTotalItem.classList.add('result-item-primary');
            resultTotalItem.style.order = 1; resultLitersItem.style.order = 2;
            if (isSubsidyMode) {
                const costNoSubsidy = totalLiters * noSubsidyPrice; const costOld = totalLiters * oldPrice;
                noteContent = `Untuk mendapatkan petrol (${totalLiters.toFixed(3)} L) yang sama:<ul><li>Pada harga di pam (RM${noSubsidyPrice.toFixed(2)}/L), anda perlu membayar <strong>RM${costNoSubsidy.toFixed(2)}</strong>.</li><li>Pada harga petrol lama (RM${oldPrice.toFixed(2)}/L), anda perlu membayar <strong>RM${costOld.toFixed(2)}</strong>.</li></ul>`;
            } else {
                const costSubsidy = totalLiters * subsidyPrice;
                noteContent = `Untuk mendapatkan petrol (${totalLiters.toFixed(3)} L) yang sama:<ul><li>Pada harga bersubsidi (RM${subsidyPrice.toFixed(2)}/L), anda hanya perlu membayar <strong>RM${costSubsidy.toFixed(2)}</strong>.</li></ul>`;
            }
        }
        resultLitersValue.innerHTML = `${totalLiters.toFixed(3)} <span class="unit">L</span>`;
        resultTotalValue.textContent = `RM${totalCost.toFixed(2)}`;
        fullCalcNote.innerHTML = noteContent;
        comparison1Value.classList.remove('savings', 'cost-increase');
        comparison2Value.classList.remove('savings', 'cost-increase');
        [comparison1Item, comparison2Item, resultTotalSubtext].forEach(el => el.classList.add('hidden'));
        const costAtOldPrice = totalLiters * oldPrice;
        const costAtNoSubsidyPrice = totalLiters * noSubsidyPrice;
        const costAtSubsidyPrice = totalLiters * subsidyPrice;
        if (isSubsidyMode) {
            resultTotalSubtext.textContent = `(Jumlah Harga Sebenar di Pam: RM${costAtNoSubsidyPrice.toFixed(2)})`;
            resultTotalSubtext.classList.remove('hidden');
            [comparison1Item, comparison2Item].forEach(el => el.classList.remove('hidden'));
            comparison1Label.textContent = 'Penjimatan (vs Harga Lama)';
            comparison1Value.textContent = `RM${(costAtOldPrice - totalCost).toFixed(2)}`;
            comparison1Value.classList.add('savings');
            comparison2Label.textContent = 'Penjimatan (vs Tanpa Subsidi)';
            comparison2Value.textContent = `RM${(costAtNoSubsidyPrice - totalCost).toFixed(2)}`;
            comparison2Value.classList.add('savings');
        } else {
            [comparison1Item, comparison2Item].forEach(el => el.classList.remove('hidden'));
            comparison1Label.textContent = 'Perbezaan Kos (vs Harga Lama)';
            const diffOld = totalCost - costAtOldPrice;
            comparison1Value.textContent = diffOld >= 0 ? `+ RM ${diffOld.toFixed(2)}` : `RM ${diffOld.toFixed(2)}`;
            comparison1Value.classList.add('cost-increase');
            comparison2Label.textContent = 'Perbezaan Kos (vs Harga Subsidi)';
            const diffSubsidy = totalCost - costAtSubsidyPrice;
            comparison2Value.textContent = diffSubsidy >= 0 ? `+ RM ${diffSubsidy.toFixed(2)}` : `RM ${diffSubsidy.toFixed(2)}`;
            comparison2Value.classList.add('cost-increase');
        }
        fullCalcResults.classList.remove('hidden');
        fullCalcResults.classList.add('fade-in');
        
        // [BARU] Auto-skrol ke keputusan
        fullCalcResults.scrollIntoView({ behavior: 'smooth' });
    };
    [modeRmBtn, modeLiterBtn].forEach(btn => btn.addEventListener('click', () => switchModeFull(btn.id.includes('rm') ? 'RM' : 'Liter')));
    petrolFormFull.addEventListener('submit', calculateFull);
    resetBtnFull.addEventListener('click', resetCalculatorFull);
    
    // --- Simple Version ---
    const petrolFormSimple = document.getElementById('petrol-form-simple');
    const modeRmBtnSimple = document.getElementById('mode-rm-simple');
    const modeLiterBtnSimple = document.getElementById('mode-liter-simple');
    const userInputSimple = document.getElementById('user-input-simple');
    const userInputLabelSimple = document.getElementById('user-input-label-simple');
    const oldPriceInputSimple = document.getElementById('old-price-simple');
    const subsidyPriceInputSimple = document.getElementById('subsidy-price-simple');
    const noSubsidyPriceInputSimple = document.getElementById('nosubsidy-price-simple');
    const simpleCalcResults = document.getElementById('simple-calc-results');
    const simpleLitersItem = document.getElementById('simple-liters-item');
    const simpleTotalItem = document.getElementById('simple-total-item');
    const simpleLitersValue = document.getElementById('simple-liters-value');
    const simpleTotalValue = document.getElementById('simple-total-value');
    const simpleTotalSubtext = document.getElementById('simple-total-subtext');
    const simpleSavingOldValue = document.getElementById('simple-saving-old-value');
    const simpleSavingNosubsidyValue = document.getElementById('simple-saving-nosubsidy-value');
    const resetBtnSimple = document.getElementById('reset-btn-simple');
    let currentModeSimple = 'RM';

    const switchModeSimple = (newMode) => {
        currentModeSimple = newMode;
        userInputSimple.value = '';
        userInputSimple.step = newMode === 'Liter' ? '0.001' : '0.01';
        userInputLabelSimple.textContent = (newMode === 'RM') ? 'Jumlah bayaran (RM)' : 'Jumlah liter (L)';
        modeRmBtnSimple.classList.toggle('active', newMode === 'RM');
        modeLiterBtnSimple.classList.toggle('active', newMode === 'Liter');
        simpleCalcResults.classList.add('hidden');
    };
    const resetCalculatorSimple = () => {
        petrolFormSimple.reset();
        userInputSimple.value = '';
        oldPriceInputSimple.value = '2.05'; subsidyPriceInputSimple.value = '1.99'; noSubsidyPriceInputSimple.value = '2.60';
        switchModeSimple('RM');
        simpleCalcResults.classList.remove('fade-in');
    };
    const calculateSimple = (event) => {
        event.preventDefault();
        const oldPrice = parseFloat(oldPriceInputSimple.value);
        const subsidyPrice = parseFloat(subsidyPriceInputSimple.value);
        const noSubsidyPrice = parseFloat(noSubsidyPriceInputSimple.value);
        const userValue = parseFloat(userInputSimple.value);
        if ([oldPrice, subsidyPrice, noSubsidyPrice, userValue].some(isNaN) || userValue <= 0) { alert('Sila masukkan semua nilai yang sah.'); return; }
        let totalLiters = (currentModeSimple === 'RM') ? userValue / subsidyPrice : userValue;
        let totalCost = totalLiters * subsidyPrice;
        [simpleLitersItem, simpleTotalItem].forEach(el => el.classList.remove('result-item-primary'));
        if (currentModeSimple === 'RM') {
            simpleLitersItem.classList.add('result-item-primary');
        } else {
            simpleTotalItem.classList.add('result-item-primary');
        }
        simpleLitersValue.innerHTML = `${totalLiters.toFixed(3)} <span class="unit">L</span>`;
        simpleTotalValue.textContent = `RM${totalCost.toFixed(2)}`;
        simpleTotalSubtext.textContent = `(Jumlah Harga Sebenar di Pam: RM${(totalLiters * noSubsidyPrice).toFixed(2)})`;
        simpleTotalSubtext.classList.remove('hidden');
        simpleSavingOldValue.textContent = `RM${((totalLiters * oldPrice) - totalCost).toFixed(2)}`;
        simpleSavingNosubsidyValue.textContent = `RM${((totalLiters * noSubsidyPrice) - totalCost).toFixed(2)}`;
        simpleCalcResults.classList.remove('hidden');
        simpleCalcResults.classList.add('fade-in');

        // [BARU] Auto-skrol ke keputusan
        simpleCalcResults.scrollIntoView({ behavior: 'smooth' });
    };
    [modeRmBtnSimple, modeLiterBtnSimple].forEach(btn => btn.addEventListener('click', () => switchModeSimple(btn.id.includes('rm') ? 'RM' : 'Liter')));
    petrolFormSimple.addEventListener('submit', calculateSimple);
    resetBtnSimple.addEventListener('click', resetCalculatorSimple);

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
    const OLD_PRICE_REF = 2.05; const SUBSIDY_PRICE = 1.99; const PUMP_PRICE = 2.60;
    let topUpMode = 'subsidi';

    const switchModeTopUp = (newMode) => {
        topUpMode = newMode;
        if (newMode === 'subsidi') { modeSubsidiBtn.classList.add('active'); modeTanpaSubsidiBtn.classList.remove('active'); } 
        else { modeTanpaSubsidiBtn.classList.add('active'); modeSubsidiBtn.classList.remove('active'); }
        [fuelGaugeContainer, topupCalcResults].forEach(el => el.classList.add('hidden'));
    };
    const resetCalculatorTopUp = () => {
        petrolFormTopUp.reset();
        switchModeTopUp('subsidi');
        [fuelGaugeContainer, topupCalcResults].forEach(el => { el.classList.add('hidden'); el.classList.remove('fade-in'); });
    };
    const calculateTopUp = (event) => {
        event.preventDefault();
        const tankCapacity = parseFloat(tankCapacityInput.value); const totalBars = parseInt(totalBarsInput.value); const currentBars = parseInt(currentBarsInput.value);
        if (isNaN(tankCapacity) || isNaN(totalBars) || isNaN(currentBars) || tankCapacity <= 0 || totalBars <= 0) { alert('Sila masukkan semua nilai yang sah.'); return; }
        if (currentBars >= totalBars) { alert('Baki bar semasa mesti kurang daripada jumlah bar penuh untuk pengiraan.'); return; }
        const basePrice = (topUpMode === 'subsidi') ? SUBSIDY_PRICE : PUMP_PRICE;
        const totalLitersNeeded = (tankCapacity / totalBars) * (totalBars - currentBars);
        const totalCost = totalLitersNeeded * basePrice;
        topupLitersValue.innerHTML = `${totalLitersNeeded.toFixed(3)} <span class="unit">L</span>`;
        topupCostValue.textContent = `RM${totalCost.toFixed(2)}`;
        [topupCostItem, topupLitersItem, topupPumpCostItem, topupSavingVsOldItem, topupSavingVsNoSubsidyItem].forEach(el => { el.classList.remove('hidden', 'full-width', 'result-item-primary'); });
        if (topUpMode === 'subsidi') {
            topupCostLabel.textContent = 'Harga Subsidi (Bayar)';
            topupCostItem.classList.add('full-width', 'result-item-primary');
            topupLitersItem.style.order = 2; topupPumpCostItem.style.order = 3; topupSavingVsOldItem.style.order = 4; topupSavingVsNoSubsidyItem.style.order = 5;
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
            topupLitersItem.style.order = 2;
            [topupPumpCostItem, topupSavingVsOldItem, topupSavingVsNoSubsidyItem].forEach(el => el.classList.add('hidden'));
        }
        [fuelGaugeContainer, topupCalcResults, scrollInstruction].forEach(el => { el.classList.remove('hidden'); el.classList.add('fade-in'); });
        
        // [BARU] Auto-skrol ke keputusan
        fuelGaugeContainer.scrollIntoView({ behavior: 'smooth' });

        gaugeVisual.innerHTML = '';
        for (let i = 1; i <= totalBars; i++) {
            const wrapper = document.createElement('div'); wrapper.className = 'bar-wrapper'; wrapper.style.animationDelay = `${i * 0.05}s`;
            const label = document.createElement('div'); label.className = 'bar-label'; label.textContent = `Bar ${i}`;
            const barDiv = document.createElement('div'); barDiv.classList.add('gauge-bar');
            if (i <= currentBars) { barDiv.classList.add('current'); } else { barDiv.classList.add('needed'); }
            const cumulativeLiters = (tankCapacity / totalBars) * i;
            const cumulativeCost = cumulativeLiters * basePrice;
            barDiv.innerHTML = `<span>${cumulativeLiters.toFixed(3)} L</span><span>RM${cumulativeCost.toFixed(2)}</span>`;
            wrapper.appendChild(label); wrapper.appendChild(barDiv); gaugeVisual.appendChild(wrapper);
        }
    };
    modeSubsidiBtn.addEventListener('click', () => switchModeTopUp('subsidi'));
    modeTanpaSubsidiBtn.addEventListener('click', () => switchModeTopUp('tanpa-subsidi'));
    petrolFormTopUp.addEventListener('submit', calculateTopUp);
    resetBtnTopUp.addEventListener('click', resetCalculatorTopUp);

    // --- CALCULATOR 3: DULU VS. SEKARANG ---
    const formDvs = document.getElementById('form-dvs');
    const modeRmDvs = document.getElementById('mode-rm-dvs');
    const modeLiterDvs = document.getElementById('mode-liter-dvs');
    const userInputDvs = document.getElementById('user-input-dvs');
    const userInputLabelDvs = document.getElementById('user-input-label-dvs');
    const resetBtnDvs = document.getElementById('reset-btn-dvs');
    const dvsResults = document.getElementById('dvs-results');
    const dvsOriginalLabel = document.getElementById('dvs-original-label');
    const dvsOriginalValue = document.getElementById('dvs-original-value');
    const dvsSubsidyCost = document.getElementById('dvs-subsidy-cost');
    const dvsSubsidySaving = document.getElementById('dvs-subsidy-saving');
    const dvsPumpCost = document.getElementById('dvs-pump-cost');
    const dvsPumpExtra = document.getElementById('dvs-pump-extra');
    const dvsExplanation = document.getElementById('dvs-explanation');
    let currentModeDvs = 'RM';

    const OLD_PRICE_DVS = 2.05;
    const NEW_SUBSIDY_PRICE_DVS = 1.99;
    const NEW_PUMP_PRICE_DVS = 2.60;

    const switchModeDvs = (newMode) => {
        currentModeDvs = newMode;
        userInputDvs.value = '';
        userInputDvs.step = newMode === 'Liter' ? '0.001' : '0.01';
        userInputLabelDvs.textContent = (newMode === 'RM') ? 'Jumlah anda bayar sebelum ini (RM)' : 'Jumlah liter anda isi sebelum ini (L)';
        modeRmDvs.classList.toggle('active', newMode === 'RM');
        modeLiterDvs.classList.toggle('active', newMode === 'Liter');
        dvsResults.classList.add('hidden');
    };
    const resetCalculatorDvs = () => {
        formDvs.reset();
        switchModeDvs('RM');
        dvsResults.classList.remove('fade-in');
    };
    const calculateDvs = (event) => {
        event.preventDefault();
        const userValue = parseFloat(userInputDvs.value);
        if (isNaN(userValue) || userValue <= 0) { alert('Sila masukkan nilai yang sah.'); return; }
        let originalLiters, originalCost, explanation;
        if (currentModeDvs === 'RM') {
            originalCost = userValue;
            originalLiters = originalCost / OLD_PRICE_DVS;
            dvsOriginalLabel.textContent = 'Dulu Anda Dapat';
            dvsOriginalValue.innerHTML = `${originalLiters.toFixed(3)} <span class="unit">L</span>`;
        } else {
            originalLiters = userValue;
            originalCost = originalLiters * OLD_PRICE_DVS;
            dvsOriginalLabel.textContent = 'Kos Dulu';
            dvsOriginalValue.textContent = `RM${originalCost.toFixed(2)}`;
        }
        const newSubsidyCost = originalLiters * NEW_SUBSIDY_PRICE_DVS;
        const newPumpCost = originalLiters * NEW_PUMP_PRICE_DVS;
        const subsidySaving = originalCost - newSubsidyCost;
        const pumpExtra = newPumpCost - originalCost;
        dvsSubsidyCost.textContent = `RM${newSubsidyCost.toFixed(2)}`;
        dvsSubsidySaving.textContent = subsidySaving >= 0 ? `Jimat: RM${subsidySaving.toFixed(2)}` : `Lebih: RM${Math.abs(subsidySaving).toFixed(2)}`;
        dvsPumpCost.textContent = `RM${newPumpCost.toFixed(2)}`;
        dvsPumpExtra.textContent = pumpExtra >= 0 ? `Lebih: RM${pumpExtra.toFixed(2)}` : `Jimat: RM${Math.abs(pumpExtra).toFixed(2)}`;
        if (currentModeDvs === 'RM') {
            explanation = `Berdasarkan bayaran lama anda sebanyak <strong>RM${originalCost.toFixed(2)}</strong>, anda mendapat <strong>${originalLiters.toFixed(3)} liter</strong> petrol. Untuk mendapatkan jumlah liter yang sama sekarang, anda perlu membayar <strong>RM${newSubsidyCost.toFixed(2)}</strong> (subsidi) atau <strong>RM${newPumpCost.toFixed(2)}</strong> (harga pam).`;
        } else {
            explanation = `Dulu, untuk mengisi <strong>${originalLiters.toFixed(3)} liter</strong> petrol, anda membayar <strong>RM${originalCost.toFixed(2)}</strong>. Untuk jumlah liter yang sama sekarang, kosnya ialah <strong>RM${newSubsidyCost.toFixed(2)}</strong> (subsidi) atau <strong>RM${newPumpCost.toFixed(2)}</strong> (harga pam).`;
        }
        dvsExplanation.innerHTML = explanation;
        dvsResults.classList.remove('hidden');
        dvsResults.classList.add('fade-in');

        // [BARU] Auto-skrol ke keputusan
        dvsResults.scrollIntoView({ behavior: 'smooth' });
    };

    [modeRmDvs, modeLiterDvs].forEach(btn => btn.addEventListener('click', () => switchModeDvs(btn.id.includes('rm') ? 'RM' : 'Liter')));
    formDvs.addEventListener('submit', calculateDvs);
    resetBtnDvs.addEventListener('click', resetCalculatorDvs);
});