import {test,expect} from '@playwright/test';

const live=process.env.JF_PRODUCTION_SMOKE==='1';
const base=process.env.JF_PRODUCTION_URL||'https://app.justfuelnutrition.co.za';

test.describe('live production smoke',()=>{
  test.skip(!live,'Runs only from the post-deploy production smoke job.');

  test.use({viewport:{width:412,height:915}});

  test('root loads without fatal UI or horizontal overflow',async({page})=>{
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(String(error?.message||error)));
    await page.goto(`${base}/?jfapp=16&legacy=cleared&qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
    await expect(page.getByText('JUST FUEL',{exact:true}).first()).toBeVisible({timeout:20000});
    await expect(page.locator('.jf-error-screen')).toHaveCount(0);
    const nav=page.locator('.bottom-nav.phase1-nav');
    await expect(nav).toBeVisible();
    for(const label of ['Home','Training','Race','Fuel','Shop'])await expect(nav.getByRole('button',{name:label,exact:true})).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
  });

  test('main navigation renders every public section without fatal errors',async({page})=>{
    await page.goto(`${base}/?jfapp=16&legacy=cleared&qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
    const nav=page.locator('.bottom-nav.phase1-nav');
    for(const label of ['Fuel','Shop','Training','Race','Home']){
      const button=nav.getByRole('button',{name:label,exact:true});
      await button.click();
      await expect(button).toHaveClass(/active/,{timeout:15000});
      await expect(page.locator('.jf-error-screen')).toHaveCount(0);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });

  test('profile opens and closes on a phone-sized viewport',async({page})=>{
    await page.goto(`${base}/?jfapp=16&legacy=cleared&qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
    await page.getByRole('button',{name:'Profile and settings'}).first().click();
    await expect(page.getByText('Profile & Settings',{exact:true})).toBeVisible({timeout:15000});
    await expect(page.locator('.jf-error-screen')).toHaveCount(0);
    await page.getByRole('button',{name:/close profile|back to profile/i}).first().click().catch(()=>{});
  });
});
